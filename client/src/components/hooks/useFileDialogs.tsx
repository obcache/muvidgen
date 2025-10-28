import { ChangeEvent, useCallback, useMemo, useRef, useState } from 'react';

type DialogOptions = {
  accept?: string;
  multiple?: boolean;
  capture?: boolean | 'user' | 'environment';
  onSelect(files: FileList | null): void;
};

export interface UseFileDialogsResult {
  openMediaDialog(callback: DialogOptions['onSelect']): void;
  openEffectDialog(callback: DialogOptions['onSelect']): void;
  DialogRoot: JSX.Element;
}

interface PendingRequest extends DialogOptions {
  id: number;
}

export const useFileDialogs = (): UseFileDialogsResult => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const requestIdRef = useRef(0);

  const schedule = useCallback((options: DialogOptions) => {
    requestIdRef.current += 1;
    setPendingRequest({ ...options, id: requestIdRef.current });
  }, []);

  const openMediaDialog = useCallback<UseFileDialogsResult['openMediaDialog']>(
    (onSelect) => {
      schedule({
        accept: 'video/*,audio/*,image/*',
        multiple: false,
        onSelect,
      });
    },
    [schedule],
  );

  const openEffectDialog = useCallback<UseFileDialogsResult['openEffectDialog']>(
    (onSelect) => {
      schedule({
        accept: '.json,.csv,.txt',
        multiple: false,
        onSelect,
      });
    },
    [schedule],
  );

  const DialogRoot = useMemo(() => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      pendingRequest?.onSelect(event.target.files);
      event.target.value = '';
      setPendingRequest(null);
    };

    const handleCancel = () => {
      pendingRequest?.onSelect(null);
      setPendingRequest(null);
    };

    if (pendingRequest && inputRef.current) {
      const input = inputRef.current;
      input.accept = pendingRequest.accept ?? '';
      input.multiple = Boolean(pendingRequest.multiple);
      window.setTimeout(() => {
        input.click();
      }, 0);
    }

    return (
      <input
        ref={inputRef}
        hidden
        type="file"
        onChange={handleChange}
        onCancel={handleCancel}
      />
    );
  }, [pendingRequest]);

  return {
    openMediaDialog,
    openEffectDialog,
    DialogRoot,
  };
};
