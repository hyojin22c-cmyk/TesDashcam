import { Show } from '@jellybrick/react-solid-flow';
import { Files, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FilePickButton } from '@/components/molecules/file-pick-button';
import { useLayoutMode } from '@/hooks/use-layout-mode';
import { isIOSOrAndroid } from '@/lib/platform';
import {
  awaitPickedFiles,
  canUseDirectoryPicker,
  cancelPickedFiles,
  loadPickedFiles,
  openDirectoryPicker,
} from '@/studio/loading';

const onPick = (files: File[]) => {
  loadPickedFiles(files).catch(reportError);
};

export const FolderPicker = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation();
  const mobile = useLayoutMode() !== 'desktop';
  const [pickerFailed, setPickerFailed] = useState(false);
  const label = mobile || isIOSOrAndroid() ? t('btn_open_folder_mobile') : t('btn_open_folder');

  return (
    <FilePickButton
      directory
      native={pickerFailed || !canUseDirectoryPicker()}
      label={label}
      variant={compact ? 'quiet' : 'default'}
      size={compact ? 'icon' : 'lg'}
      onClick={() => {
        openDirectoryPicker()
          .then((opened) => setPickerFailed(!opened))
          .catch(reportError);
      }}
      onActivate={awaitPickedFiles}
      onCancel={cancelPickedFiles}
      onPick={onPick}
    >
      <Show when={compact}>
        <FolderOpen />
      </Show>
    </FilePickButton>
  );
};

export const FilesPicker = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation();
  return (
    <FilePickButton
      variant={compact ? 'quiet' : 'solid'}
      size={compact ? 'icon' : undefined}
      label={t('btn_open_files')}
      onActivate={awaitPickedFiles}
      onCancel={cancelPickedFiles}
      onPick={onPick}
    >
      <Show when={compact}>
        <Files />
      </Show>
    </FilePickButton>
  );
};
