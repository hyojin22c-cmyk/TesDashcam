import { For } from '@jellybrick/react-solid-flow';
import { groupBy, sumBy } from 'es-toolkit';
import { ChevronDown, Folder } from 'lucide-react';
import {
  createContext,
  use,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Virtualizer, type VirtualizerHandle } from 'virtua';

import { Reveal } from '@/components/atoms/reveal';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Swap } from '@/components/atoms/swap';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/molecules/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/molecules/context-menu';
import { ListItem } from '@/components/molecules/list-item';
import {
  type ClipItem,
  type FolderDisplayInfo,
  type FolderGroup,
  formatFolderGroup,
} from '@/core/clip-scanner';
import { isMobileDevice } from '@/lib/platform';
import { filterClipGroups } from '@/studio/clip-search';
import { selectClip } from '@/studio/playback';
import { endRangeAtClip, isClipInRange, rangeBounds, startRangeAtClip } from '@/studio/range';
import { setStudio, useStudio } from '@/studio/store';

import { useClipSearch } from './clip-search-context';

const ClipTreeContext = createContext({
  activeGroup: 'clip-tree',
  isOpen: (_folder: string, fallback: boolean) => fallback,
  setOpen: (_folder: string, _open: boolean) => {},
});

const CATEGORY_LABELS = {
  recent: 'folder_recent',
  saved: 'folder_saved',
  sentry: 'folder_sentry',
  default: 'folder_other',
} as const satisfies Record<FolderDisplayInfo['type'], string>;

type Category = keyof typeof CATEGORY_LABELS;
type TreeRow =
  | { kind: 'category'; category: Category; count: number; open: boolean }
  | { kind: 'folder'; group: FolderGroup; defaultOpen: boolean };

const categoryKey = (category: Category) => `category:${category}`;
const folderKey = (group: FolderGroup) => `folder:${group.folderName}`;

const ClipCategory = ({
  category,
  count,
  open,
}: {
  category: Category;
  count: number;
  open: boolean;
}) => {
  const { t } = useTranslation();
  const { setOpen } = use(ClipTreeContext);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(categoryKey(category), !open)}
      className="flex min-h-11 w-full items-center gap-2 rounded-md px-4 text-left text-title text-foreground hover:bg-muted"
    >
      <Folder aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        {t(CATEGORY_LABELS[category])} ({count})
      </span>
      <ChevronDown
        aria-hidden="true"
        className={`size-4 shrink-0 transition-transform duration-400 ease-spring ${open ? '' : '-rotate-90'}`}
      />
    </button>
  );
};

const isDefaultOpen = (
  group: FolderGroup,
  index: number,
  groups: FolderGroup[],
  activeFolder?: string,
) => {
  if (groups.length === 1) return true;
  if (isMobileDevice()) {
    if (formatFolderGroup(group.folderName, group.clips).type !== 'recent') return false;
    return activeFolder ? group.folderName === activeFolder : index === 0;
  }
  return activeFolder
    ? group.folderName === activeFolder || group.clips.some((clip) => clip.folder === activeFolder)
    : index === 0;
};

const openClip = (clip: ClipItem) => {
  setStudio({ explorerExpanded: false, drawerOpen: false });
  selectClip(clip).catch(reportError);
};

const ClipRow = ({ clip }: { clip: ClipItem }) => {
  const { t } = useTranslation();
  const { activeGroup } = use(ClipTreeContext);
  const active = useStudio((state) => state.activeClip?.id === clip.id);
  const highlighted = useStudio((state) => isClipInRange(clip, rangeBounds(state)));
  const [date, time] = clip.timestampStr.split(' ');
  const channels = Math.max(
    Object.keys(clip.cams).length,
    Object.keys(clip.camHandles ?? {}).length,
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <ListItem
            title={time}
            description={`${date} · ${channels}${t('tag_channels')}`}
            active={active}
            activeGroup={activeGroup}
            highlighted={highlighted}
            onClick={() => openClip(clip)}
          />
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={() => openClip(clip)}>{t('ctx_open_clip')}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => startRangeAtClip(clip)}>
          {t('ctx_range_from_clip')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => endRangeAtClip(clip)}>
          {t('ctx_range_to_clip')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const ClipFolder = ({ group, defaultOpen }: { group: FolderGroup; defaultOpen: boolean }) => {
  const { isOpen, setOpen } = use(ClipTreeContext);
  const open = isOpen(folderKey(group), defaultOpen);
  const info = formatFolderGroup(group.folderName, group.clips);
  const title = info.displayTitle.includes('(')
    ? info.displayTitle
    : `${info.displayTitle} (${group.clips.length})`;
  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpen(folderKey(group), next)}
      className="pb-3 pl-3"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-title text-muted-foreground transition-colors duration-400 ease-fade hover:text-foreground">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform duration-400 ease-spring ${open ? '' : '-rotate-90'}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col pt-1">
        <For each={group.clips}>{(clip) => <ClipRow key={clip.id} clip={clip} />}</For>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const ClipTree = ({ scrollToActive = false }: { scrollToActive?: boolean }) => {
  const { t } = useTranslation();
  const activeGroup = useId();
  const groups = useStudio((state) => state.folderGroups);
  const activeFolder = useStudio((state) => state.activeClip?.folder);
  const query = useDeferredValue(useClipSearch().query);
  const visible = filterClipGroups(groups, query);
  const searching = visible !== groups;
  const toggled = useStudio((state) => state.clipFolders);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtualizerHandle>(null);

  const summary =
    visible.length > 0
      ? t('search_results', { 0: sumBy(visible, (group) => group.clips.length) })
      : t('search_empty');

  const tree = {
    activeGroup,
    isOpen: (folder: string, fallback: boolean) =>
      (toggled.query === query ? toggled.open[folder] : undefined) ?? fallback,
    setOpen: (folder: string, open: boolean) =>
      setStudio(({ clipFolders }) => ({
        clipFolders: {
          query,
          open: { ...(clipFolders.query === query ? clipFolders.open : {}), [folder]: open },
        },
      })),
  };

  const categorized = groupBy(
    visible,
    (group) => formatFolderGroup(group.folderName, group.clips).type,
  );
  const rows: TreeRow[] = [];
  let activeIndex = -1;
  for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
    const folders = categorized[category];
    if (!folders?.length) continue;
    const open = tree.isOpen(categoryKey(category), searching);
    const headerIndex = rows.length;
    rows.push({ kind: 'category', category, count: folders.length, open });
    const activeInCategory = folders.findIndex((group) => group.folderName === activeFolder);
    if (activeInCategory >= 0) {
      activeIndex = open ? headerIndex + 1 + activeInCategory : headerIndex;
    }
    if (open) {
      folders.forEach((group, index) => {
        rows.push({
          kind: 'folder',
          group,
          defaultOpen: searching || isDefaultOpen(group, index, folders, activeFolder),
        });
      });
    }
  }

  const centerActiveGroup = useEffectEvent(() => {
    if (activeIndex >= 0) listRef.current?.scrollToIndex(activeIndex, { align: 'center' });
  });
  useEffect(() => {
    if (scrollToActive) centerActiveGroup();
  }, [scrollToActive, activeFolder]);

  return (
    <ClipTreeContext value={tree}>
      <Reveal show={searching} className="px-4 pb-2">
        <Swap id={summary}>
          <p role="status" className="text-body text-muted-foreground">
            {summary}
          </p>
        </Swap>
      </Reveal>
      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <Virtualizer ref={listRef} scrollRef={viewportRef} data={rows} bufferSize={600}>
          {(row) =>
            row.kind === 'category' ? (
              <ClipCategory
                key={categoryKey(row.category)}
                category={row.category}
                count={row.count}
                open={row.open}
              />
            ) : (
              <ClipFolder
                key={folderKey(row.group)}
                group={row.group}
                defaultOpen={row.defaultOpen}
              />
            )
          }
        </Virtualizer>
      </ScrollArea>
    </ClipTreeContext>
  );
};
