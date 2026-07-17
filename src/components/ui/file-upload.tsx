"use client";

import { useDirection } from "@base-ui/react/direction-provider";
import { useRender } from "@base-ui/react/use-render";
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileCogIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import * as React from "react";

import { useAsRef } from "#/hooks/use-as-ref";
import { useLazyRef } from "#/hooks/use-lazy-ref";
import { cn } from "#/lib/utils";

const ROOT_NAME = "FileUpload";
const DROPZONE_NAME = "FileUploadDropzone";
const TRIGGER_NAME = "FileUploadTrigger";
const LIST_NAME = "FileUploadList";
const ITEM_NAME = "FileUploadItem";
const ITEM_PREVIEW_NAME = "FileUploadItemPreview";
const ITEM_METADATA_NAME = "FileUploadItemMetadata";
const ITEM_PROGRESS_NAME = "FileUploadItemProgress";
const ITEM_DELETE_NAME = "FileUploadItemDelete";
const CLEAR_NAME = "FileUploadClear";

const EMPTY_FILE = { name: "", size: 0, type: "" } as File;

type RenderProp<State extends Record<string, unknown> = Record<string, unknown>> =
  | React.ReactElement<Record<string, unknown>>
  | ((props: React.HTMLAttributes<HTMLElement>, state: State) => React.ReactElement);

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

function getFileIcon(file: File) {
  const type = file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (type.startsWith("video/")) {
    return <FileVideoIcon />;
  }

  if (type.startsWith("audio/")) {
    return <FileAudioIcon />;
  }

  if (type.startsWith("text/") || ["txt", "md", "rtf", "pdf"].includes(extension)) {
    return <FileTextIcon />;
  }

  if (
    [
      "html",
      "css",
      "js",
      "jsx",
      "ts",
      "tsx",
      "json",
      "xml",
      "php",
      "py",
      "rb",
      "java",
      "c",
      "cpp",
      "cs",
    ].includes(extension)
  ) {
    return <FileCodeIcon />;
  }

  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension)) {
    return <FileArchiveIcon />;
  }

  if (
    ["exe", "msi", "app", "apk", "deb", "rpm"].includes(extension) ||
    type.startsWith("application/")
  ) {
    return <FileCogIcon />;
  }

  return <FileIcon />;
}

type Direction = "ltr" | "rtl";

interface FileState {
  file: File;
  progress: number;
  error?: string;
  status: "idle" | "uploading" | "error" | "success";
}

interface StoreState {
  files: Map<File, FileState>;
  dragOver: boolean;
  invalid: boolean;
}

type StoreAction =
  | { type: "ADD_FILES"; files: File[] }
  | { type: "SET_FILES"; files: File[] }
  | { type: "SET_PROGRESS"; file: File; progress: number }
  | { type: "SET_SUCCESS"; file: File }
  | { type: "SET_ERROR"; file: File; error: string }
  | { type: "REMOVE_FILE"; file: File }
  | { type: "SET_DRAG_OVER"; dragOver: boolean }
  | { type: "SET_INVALID"; invalid: boolean }
  | { type: "CLEAR" };

type Store = {
  getState: () => StoreState;
  dispatch: (action: StoreAction) => void;
  subscribe: (listener: () => void) => () => void;
};

const StoreContext = React.createContext<Store | null>(null);

function useStoreContext(consumerName: string) {
  const context = React.useContext(StoreContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

function useStore<T>(selector: (state: StoreState) => T): T {
  const store = useStoreContext("useStore");

  const lastValueRef = useLazyRef<{ value: T; state: StoreState } | null>(() => null);

  const getSnapshot = React.useCallback(() => {
    const state = store.getState();
    const prevValue = lastValueRef.current;

    if (prevValue && prevValue.state === state) {
      return prevValue.value;
    }

    const nextValue = selector(state);
    lastValueRef.current = { value: nextValue, state };
    return nextValue;
  }, [store, selector, lastValueRef]);

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface FileUploadContextValue {
  inputId: string;
  dropzoneId: string;
  listId: string;
  labelId: string;
  disabled: boolean;
  dir: Direction;
  inputRef: React.RefObject<HTMLInputElement | null>;
  urlCache: WeakMap<File, string>;
}

const FileUploadContext = React.createContext<FileUploadContextValue | null>(null);

function useFileUploadContext(consumerName: string) {
  const context = React.useContext(FileUploadContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface FileUploadProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  value?: File[];
  defaultValue?: File[];
  onValueChange?: (files: File[]) => void;
  onAccept?: (files: File[]) => void;
  onFileAccept?: (file: File) => void;
  onFileReject?: (file: File, message: string) => void;
  onFileValidate?: (file: File) => string | null | undefined;
  onUpload?: (
    files: File[],
    options: {
      onProgress: (file: File, progress: number) => void;
      onSuccess: (file: File) => void;
      onError: (file: File, error: Error) => void;
    },
  ) => Promise<void> | void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  dir?: Direction;
  label?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  multiple?: boolean;
  required?: boolean;
  render?: RenderProp;
}

function FileUpload(props: FileUploadProps) {
  const {
    value,
    defaultValue,
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
    accept,
    maxFiles,
    maxSize,
    dir: dirProp,
    label,
    name,
    disabled = false,
    invalid = false,
    multiple = false,
    required = false,
    render,
    children,
    className,
    ...rootProps
  } = props;

  const inputId = React.useId();
  const dropzoneId = React.useId();
  const listId = React.useId();
  const labelId = React.useId();

  const contextDir = useDirection();
  const dir = dirProp ?? contextDir;
  const listeners = useLazyRef(() => new Set<() => void>()).current;
  const files = useLazyRef<Map<File, FileState>>(() => new Map()).current;
  const urlCache = useLazyRef(() => new WeakMap<File, string>()).current;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;

  const propsRef = useAsRef({
    onValueChange,
    onAccept,
    onFileAccept,
    onFileReject,
    onFileValidate,
    onUpload,
  });

  const store = React.useMemo<Store>(() => {
    let state: StoreState = {
      files,
      dragOver: false,
      invalid: invalid,
    };

    function reducer(state: StoreState, action: StoreAction): StoreState {
      switch (action.type) {
        case "ADD_FILES": {
          for (const file of action.files) {
            files.set(file, {
              file,
              progress: 0,
              status: "idle",
            });
          }

          if (propsRef.current.onValueChange) {
            const fileList = Array.from(files.values()).map((fileState) => fileState.file);
            propsRef.current.onValueChange(fileList);
          }
          return { ...state, files };
        }

        case "SET_FILES": {
          const newFileSet = new Set(action.files);
          for (const existingFile of files.keys()) {
            if (!newFileSet.has(existingFile)) {
              files.delete(existingFile);
            }
          }

          for (const file of action.files) {
            const existingState = files.get(file);
            if (!existingState) {
              files.set(file, {
                file,
                progress: 0,
                status: "idle",
              });
            }
          }
          return { ...state, files };
        }

        case "SET_PROGRESS": {
          const fileState = files.get(action.file);
          if (fileState) {
            files.set(action.file, {
              ...fileState,
              progress: action.progress,
              status: "uploading",
            });
          }
          return { ...state, files };
        }

        case "SET_SUCCESS": {
          const fileState = files.get(action.file);
          if (fileState) {
            files.set(action.file, {
              ...fileState,
              progress: 100,
              status: "success",
            });
          }
          return { ...state, files };
        }

        case "SET_ERROR": {
          const fileState = files.get(action.file);
          if (fileState) {
            files.set(action.file, {
              ...fileState,
              error: action.error,
              status: "error",
            });
          }
          return { ...state, files };
        }

        case "REMOVE_FILE": {
          const cachedUrl = urlCache.get(action.file);
          if (cachedUrl) {
            URL.revokeObjectURL(cachedUrl);
            urlCache.delete(action.file);
          }

          files.delete(action.file);

          if (propsRef.current.onValueChange) {
            const fileList = Array.from(files.values()).map((fileState) => fileState.file);
            propsRef.current.onValueChange(fileList);
          }
          return { ...state, files };
        }

        case "SET_DRAG_OVER": {
          return { ...state, dragOver: action.dragOver };
        }

        case "SET_INVALID": {
          return { ...state, invalid: action.invalid };
        }

        case "CLEAR": {
          for (const file of files.keys()) {
            const cachedUrl = urlCache.get(file);
            if (cachedUrl) {
              URL.revokeObjectURL(cachedUrl);
              urlCache.delete(file);
            }
          }

          files.clear();
          if (propsRef.current.onValueChange) {
            propsRef.current.onValueChange([]);
          }
          return { ...state, files, invalid: false };
        }

        default:
          return state;
      }
    }

    return {
      getState: () => state,
      dispatch: (action) => {
        state = reducer(state, action);
        for (const listener of listeners) {
          listener();
        }
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }, [listeners, files, invalid, propsRef, urlCache]);

  const acceptTypes = React.useMemo(
    () => accept?.split(",").map((t) => t.trim()) ?? null,
    [accept],
  );

  const onProgress = useLazyRef(() => {
    let frame = 0;
    return (file: File, progress: number) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        store.dispatch({
          type: "SET_PROGRESS",
          file,
          progress: Math.min(Math.max(0, progress), 100),
        });
      });
    };
  }).current;

  React.useEffect(() => {
    if (isControlled) {
      store.dispatch({ type: "SET_FILES", files: value });
    } else if (defaultValue && defaultValue.length > 0 && !store.getState().files.size) {
      store.dispatch({ type: "SET_FILES", files: defaultValue });
    }
  }, [value, defaultValue, isControlled, store]);

  React.useEffect(() => {
    return () => {
      for (const file of files.keys()) {
        const cachedUrl = urlCache.get(file);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
        }
      }
    };
  }, [files, urlCache]);

  const onFilesUpload = React.useCallback(
    async (files: File[]) => {
      try {
        for (const file of files) {
          store.dispatch({ type: "SET_PROGRESS", file, progress: 0 });
        }

        if (propsRef.current.onUpload) {
          await propsRef.current.onUpload(files, {
            onProgress,
            onSuccess: (file) => {
              store.dispatch({ type: "SET_SUCCESS", file });
            },
            onError: (file, error) => {
              store.dispatch({
                type: "SET_ERROR",
                file,
                error: error.message ?? "Upload failed",
              });
            },
          });
        } else {
          for (const file of files) {
            store.dispatch({ type: "SET_SUCCESS", file });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Upload failed";
        for (const file of files) {
          store.dispatch({
            type: "SET_ERROR",
            file,
            error: errorMessage,
          });
        }
      }
    },
    [store, propsRef, onProgress],
  );

  const onFilesChange = React.useCallback(
    (originalFiles: File[]) => {
      if (disabled) return;

      let filesToProcess = [...originalFiles];
      let invalid = false;

      if (maxFiles) {
        const currentCount = store.getState().files.size;
        const remainingSlotCount = Math.max(0, maxFiles - currentCount);

        if (remainingSlotCount < filesToProcess.length) {
          const rejectedFiles = filesToProcess.slice(remainingSlotCount);
          invalid = true;

          filesToProcess = filesToProcess.slice(0, remainingSlotCount);

          for (const file of rejectedFiles) {
            let rejectionMessage = `Maximum ${maxFiles} files allowed`;

            if (propsRef.current.onFileValidate) {
              const validationMessage = propsRef.current.onFileValidate(file);
              if (validationMessage) {
                rejectionMessage = validationMessage;
              }
            }

            propsRef.current.onFileReject?.(file, rejectionMessage);
          }
        }
      }

      const acceptedFiles: File[] = [];
      const rejectedFiles: { file: File; message: string }[] = [];

      for (const file of filesToProcess) {
        let rejected = false;
        let rejectionMessage = "";

        if (propsRef.current.onFileValidate) {
          const validationMessage = propsRef.current.onFileValidate(file);
          if (validationMessage) {
            rejectionMessage = validationMessage;
            propsRef.current.onFileReject?.(file, rejectionMessage);
            rejected = true;
            invalid = true;
            continue;
          }
        }

        if (acceptTypes) {
          const fileType = file.type;
          const fileExtension = `.${file.name.split(".").pop()}`;

          if (
            !acceptTypes.some(
              (type) =>
                type === fileType ||
                type === fileExtension ||
                (type.includes("/*") && fileType.startsWith(type.replace("/*", "/"))),
            )
          ) {
            rejectionMessage = "File type not accepted";
            propsRef.current.onFileReject?.(file, rejectionMessage);
            rejected = true;
            invalid = true;
          }
        }

        if (maxSize && file.size > maxSize) {
          rejectionMessage = "File too large";
          propsRef.current.onFileReject?.(file, rejectionMessage);
          rejected = true;
          invalid = true;
        }

        if (!rejected) {
          acceptedFiles.push(file);
        } else {
          rejectedFiles.push({ file, message: rejectionMessage });
        }
      }

      if (invalid) {
        store.dispatch({ type: "SET_INVALID", invalid });
        setTimeout(() => {
          store.dispatch({ type: "SET_INVALID", invalid: false });
        }, 2000);
      }

      if (acceptedFiles.length > 0) {
        store.dispatch({ type: "ADD_FILES", files: acceptedFiles });

        if (isControlled && propsRef.current.onValueChange) {
          const currentFiles = Array.from(store.getState().files.values()).map((f) => f.file);
          propsRef.current.onValueChange([...currentFiles]);
        }

        if (propsRef.current.onAccept) {
          propsRef.current.onAccept(acceptedFiles);
        }

        for (const file of acceptedFiles) {
          propsRef.current.onFileAccept?.(file);
        }

        if (propsRef.current.onUpload) {
          requestAnimationFrame(() => {
            onFilesUpload(acceptedFiles);
          });
        }
      }
    },
    [store, isControlled, propsRef, onFilesUpload, maxFiles, acceptTypes, maxSize, disabled],
  );

  const onInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      onFilesChange(files);
      event.target.value = "";
    },
    [onFilesChange],
  );

  const contextValue = React.useMemo<FileUploadContextValue>(
    () => ({
      dropzoneId,
      inputId,
      listId,
      labelId,
      dir,
      disabled,
      inputRef,
      urlCache,
    }),
    [dropzoneId, inputId, listId, labelId, dir, disabled, urlCache],
  );

  const rootElement = useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-disabled": disabled ? "" : undefined,
      "data-slot": "file-upload",
      dir,
      ...rootProps,
      className: cn("relative flex flex-col gap-2", className),
      children,
    },
  });

  return (
    <StoreContext.Provider value={store}>
      <FileUploadContext.Provider value={contextValue}>
        {rootElement}
        <input
          type="file"
          id={inputId}
          aria-labelledby={labelId}
          aria-describedby={dropzoneId}
          ref={inputRef}
          tabIndex={-1}
          accept={accept}
          name={name}
          className="sr-only"
          disabled={disabled}
          multiple={multiple}
          required={required}
          onChange={onInputChange}
        />
        <div id={labelId} className="sr-only">
          {label ?? "File upload"}
        </div>
      </FileUploadContext.Provider>
    </StoreContext.Provider>
  );
}

interface FileUploadDropzoneProps extends React.ComponentProps<"div"> {
  render?: RenderProp<{
    disabled: boolean;
    dragging: boolean;
    invalid: boolean;
  }>;
}

function FileUploadDropzone(props: FileUploadDropzoneProps) {
  const {
    render,
    children,
    className,
    onClick: onClickProp,
    onDragOver: onDragOverProp,
    onDragEnter: onDragEnterProp,
    onDragLeave: onDragLeaveProp,
    onDrop: onDropProp,
    onPaste: onPasteProp,
    onKeyDown: onKeyDownProp,
    ...dropzoneProps
  } = props;

  const context = useFileUploadContext(DROPZONE_NAME);
  const store = useStoreContext(DROPZONE_NAME);
  const dragOver = useStore((state) => state.dragOver);
  const invalid = useStore((state) => state.invalid);

  const propsRef = useAsRef({
    onClick: onClickProp,
    onDragOver: onDragOverProp,
    onDragEnter: onDragEnterProp,
    onDragLeave: onDragLeaveProp,
    onDrop: onDropProp,
    onPaste: onPasteProp,
    onKeyDown: onKeyDownProp,
  });

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      propsRef.current.onClick?.(event);

      if (event.defaultPrevented) return;

      const target = event.target;

      const isFromTrigger =
        target instanceof HTMLElement && target.closest('[data-slot="file-upload-trigger"]');

      if (!isFromTrigger) {
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, propsRef],
  );

  const onDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragOver?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: true });
    },
    [store, propsRef],
  );

  const onDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragEnter?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: true });
    },
    [store, propsRef],
  );

  const onDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDragLeave?.(event);

      if (event.defaultPrevented) return;

      const relatedTarget = event.relatedTarget;
      if (
        relatedTarget &&
        relatedTarget instanceof Node &&
        event.currentTarget.contains(relatedTarget)
      ) {
        return;
      }

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: false });
    },
    [store, propsRef],
  );

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      propsRef.current.onDrop?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: false });

      const files = Array.from(event.dataTransfer.files);
      const inputElement = context.inputRef.current;
      if (!inputElement) return;

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [store, context.inputRef, propsRef],
  );

  const onPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      propsRef.current.onPaste?.(event);

      if (event.defaultPrevented) return;

      event.preventDefault();
      store.dispatch({ type: "SET_DRAG_OVER", dragOver: false });

      const items = event.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item?.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length === 0) return;

      const inputElement = context.inputRef.current;
      if (!inputElement) return;

      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      inputElement.files = dataTransfer.files;
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [store, context.inputRef, propsRef],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      propsRef.current.onKeyDown?.(event);

      if (!event.defaultPrevented && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        context.inputRef.current?.click();
      }
    },
    [context.inputRef, propsRef],
  );

  return useRender({
    defaultTagName: "div",
    render,
    state: {
      disabled: context.disabled,
      dragging: dragOver,
      invalid,
    },
    props: {
      role: "region",
      id: context.dropzoneId,
      "aria-controls": `${context.inputId} ${context.listId}`,
      "aria-disabled": context.disabled,
      "aria-invalid": invalid,
      "data-disabled": context.disabled ? "" : undefined,
      "data-dragging": dragOver ? "" : undefined,
      "data-invalid": invalid ? "" : undefined,
      "data-slot": "file-upload-dropzone",
      dir: context.dir,
      tabIndex: context.disabled ? undefined : 0,
      ...dropzoneProps,
      className: cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors outline-none select-none hover:bg-accent/30 focus-visible:border-ring/50 data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20 data-disabled:pointer-events-none",
        className,
      ),
      children,
      onClick,
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
      onKeyDown,
      onPaste,
    },
  });
}

interface FileUploadTriggerProps extends React.ComponentProps<"button"> {
  render?: RenderProp<{ disabled: boolean }>;
}

function FileUploadTrigger(props: FileUploadTriggerProps) {
  const { render, children, onClick: onClickProp, ...triggerProps } = props;

  const context = useFileUploadContext(TRIGGER_NAME);

  const propsRef = useAsRef({
    onClick: onClickProp,
  });

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      propsRef.current.onClick?.(event);

      if (event.defaultPrevented) return;

      context.inputRef.current?.click();
    },
    [context.inputRef, propsRef],
  );

  return useRender({
    defaultTagName: "button",
    render,
    state: { disabled: context.disabled },
    props: {
      type: "button",
      "aria-controls": context.inputId,
      "data-disabled": context.disabled ? "" : undefined,
      "data-slot": "file-upload-trigger",
      ...triggerProps,
      disabled: context.disabled,
      children,
      onClick,
    },
  });
}

interface FileUploadListProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical";
  forceMount?: boolean;
  render?: RenderProp<{
    orientation: "horizontal" | "vertical";
    state: "active" | "inactive";
  }>;
}

function FileUploadList(props: FileUploadListProps) {
  const { className, orientation = "vertical", forceMount, render, children, ...listProps } = props;

  const context = useFileUploadContext(LIST_NAME);
  const fileCount = useStore((state) => state.files.size);
  const shouldRender = forceMount || fileCount > 0;

  const listState = shouldRender ? "active" : "inactive";

  return useRender({
    defaultTagName: "div",
    enabled: shouldRender,
    render,
    state: { orientation, state: listState },
    props: {
      role: "list",
      id: context.listId,
      "aria-orientation": orientation,
      "data-orientation": orientation,
      "data-slot": "file-upload-list",
      "data-state": listState,
      dir: context.dir,
      ...listProps,
      className: cn(
        "flex flex-col gap-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-top-2 data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:slide-out-to-top-2",
        orientation === "horizontal" && "flex-row overflow-x-auto p-1.5",
        className,
      ),
      children,
    },
  });
}

interface FileUploadItemContextValue {
  id: string;
  fileState: FileState | undefined;
  nameId: string;
  sizeId: string;
  statusId: string;
  messageId: string;
}

const FileUploadItemContext = React.createContext<FileUploadItemContextValue | null>(null);

function useFileUploadItemContext(consumerName: string) {
  const context = React.useContext(FileUploadItemContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``);
  }
  return context;
}

interface FileUploadItemProps extends React.ComponentProps<"div"> {
  value: File;
  render?: RenderProp<{
    file: File;
    status: FileState["status"];
  }>;
}

function FileUploadItem(props: FileUploadItemProps) {
  const { value, render, children, className, ...itemProps } = props;

  const id = React.useId();
  const statusId = `${id}-status`;
  const nameId = `${id}-name`;
  const sizeId = `${id}-size`;
  const messageId = `${id}-message`;

  const context = useFileUploadContext(ITEM_NAME);
  const fileState = useStore((state) => state.files.get(value));
  const fileCount = useStore((state) => state.files.size);
  const fileIndex = useStore((state) => {
    const files = Array.from(state.files.keys());
    return files.indexOf(value) + 1;
  });

  const itemContext = React.useMemo(
    () => ({
      id,
      fileState,
      nameId,
      sizeId,
      statusId,
      messageId,
    }),
    [id, fileState, statusId, nameId, sizeId, messageId],
  );

  const currentFileState =
    fileState ??
    ({
      file: value,
      progress: 0,
      status: "idle",
    } satisfies FileState);

  const statusText = currentFileState.error
    ? `Error: ${currentFileState.error}`
    : currentFileState.status === "uploading"
      ? `Uploading: ${currentFileState.progress}% complete`
      : currentFileState.status === "success"
        ? "Upload complete"
        : "Ready to upload";

  const itemElement = useRender({
    defaultTagName: "div",
    enabled: Boolean(fileState),
    render,
    state: {
      file: currentFileState.file,
      status: currentFileState.status,
    },
    props: {
      role: "listitem",
      id,
      "aria-setsize": fileCount,
      "aria-posinset": fileIndex,
      "aria-describedby": `${nameId} ${sizeId} ${statusId} ${currentFileState.error ? messageId : ""}`,
      "aria-labelledby": nameId,
      "data-slot": "file-upload-item",
      dir: context.dir,
      ...itemProps,
      className: cn("relative flex items-center gap-2.5 rounded-md border p-3", className),
      children: (
        <>
          {children}
          <span id={statusId} className="sr-only">
            {statusText}
          </span>
        </>
      ),
    },
  });

  if (!fileState) return null;

  return (
    <FileUploadItemContext.Provider value={itemContext}>
      {itemElement}
    </FileUploadItemContext.Provider>
  );
}

interface FileUploadItemPreviewBaseProps extends React.ComponentProps<"div"> {
  render?: RenderProp<{
    file: File;
    status: FileState["status"];
  }>;
  previewRender?: (file: File, fallback: () => React.ReactNode) => React.ReactNode;
}

function FileUploadItemPreview(props: FileUploadItemPreviewBaseProps) {
  const { previewRender, render, children, className, ...previewProps } = props;

  const itemContext = useFileUploadItemContext(ITEM_PREVIEW_NAME);
  const context = useFileUploadContext(ITEM_PREVIEW_NAME);

  const getDefaultRender = React.useCallback(
    (file: File) => {
      if (itemContext.fileState?.file.type.startsWith("image/")) {
        let url = context.urlCache.get(file);
        if (!url) {
          url = URL.createObjectURL(file);
          context.urlCache.set(file, url);
        }

        return (
          // biome-ignore lint/performance/noImgElement: dynamic file URLs from user uploads don't work well with Next.js Image optimization
          <img src={url} alt={file.name} className="size-full object-cover" />
        );
      }

      return getFileIcon(file);
    },
    [itemContext.fileState?.file.type, context.urlCache],
  );

  const onPreviewRender = React.useCallback(
    (file: File) => {
      if (previewRender) {
        return previewRender(file, () => getDefaultRender(file));
      }

      return getDefaultRender(file);
    },
    [previewRender, getDefaultRender],
  );

  const currentFileState =
    itemContext.fileState ??
    ({
      file: EMPTY_FILE,
      progress: 0,
      status: "idle",
    } satisfies FileState);

  return useRender({
    defaultTagName: "div",
    enabled: Boolean(itemContext.fileState),
    render,
    state: {
      file: currentFileState.file,
      status: currentFileState.status,
    },
    props: {
      "aria-labelledby": itemContext.nameId,
      "data-slot": "file-upload-preview",
      ...previewProps,
      className: cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50 [&>svg]:size-10",
        className,
      ),
      children: (
        <>
          {itemContext.fileState ? onPreviewRender(itemContext.fileState.file) : null}
          {children}
        </>
      ),
    },
  });
}

interface FileUploadItemMetadataProps extends React.ComponentProps<"div"> {
  size?: "default" | "sm";
  render?: RenderProp<{
    file: File;
    status: FileState["status"];
  }>;
}

function FileUploadItemMetadata(props: FileUploadItemMetadataProps) {
  const { render, size = "default", children, className, ...metadataProps } = props;

  const context = useFileUploadContext(ITEM_METADATA_NAME);
  const itemContext = useFileUploadItemContext(ITEM_METADATA_NAME);

  const currentFileState =
    itemContext.fileState ??
    ({
      file: EMPTY_FILE,
      progress: 0,
      status: "idle",
    } satisfies FileState);

  return useRender({
    defaultTagName: "div",
    enabled: Boolean(itemContext.fileState),
    render,
    state: {
      file: currentFileState.file,
      status: currentFileState.status,
    },
    props: {
      "data-slot": "file-upload-metadata",
      dir: context.dir,
      ...metadataProps,
      className: cn("flex min-w-0 flex-1 flex-col", className),
      children: children ?? (
        <>
          <span
            id={itemContext.nameId}
            className={cn(
              "truncate text-sm font-medium",
              size === "sm" && "text-[13px] leading-snug font-normal",
            )}
          >
            {currentFileState.file.name}
          </span>
          <span
            id={itemContext.sizeId}
            className={cn(
              "truncate text-xs text-muted-foreground",
              size === "sm" && "text-[11px] leading-snug",
            )}
          >
            {formatBytes(currentFileState.file.size)}
          </span>
          {currentFileState.error && (
            <span id={itemContext.messageId} className="text-xs text-destructive">
              {currentFileState.error}
            </span>
          )}
        </>
      ),
    },
  });
}
interface FileUploadItemProgressProps extends React.ComponentProps<"div"> {
  variant?: "linear" | "circular" | "fill";
  size?: number;
  forceMount?: boolean;
  render?: RenderProp<{
    progress: number;
    status: FileState["status"];
  }>;
}

function FileUploadItemProgress(props: FileUploadItemProgressProps) {
  const {
    variant = "linear",
    size = 40,
    forceMount,
    render,
    children,
    className,
    ...progressProps
  } = props;

  const itemContext = useFileUploadItemContext(ITEM_PROGRESS_NAME);
  const currentFileState =
    itemContext.fileState ??
    ({
      file: EMPTY_FILE,
      progress: 0,
      status: "idle",
    } satisfies FileState);

  const shouldRender =
    Boolean(itemContext.fileState) && (forceMount || currentFileState.progress !== 100);

  const progressState = {
    progress: currentFileState.progress,
    status: currentFileState.status,
  };

  let progressClassName = cn(
    "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
    className,
  );
  let progressStyle = progressProps.style;
  let progressChildren: React.ReactNode = (
    <>
      <div
        className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-linear"
        style={{
          transform: `translateX(-${100 - currentFileState.progress}%)`,
        }}
      />
      {children}
    </>
  );

  switch (variant) {
    case "circular": {
      const circumference = 2 * Math.PI * ((size - 4) / 2);
      const strokeDashoffset = circumference - (currentFileState.progress / 100) * circumference;

      progressClassName = cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        className,
      );
      progressChildren = (
        <>
          <svg
            className="-rotate-90 transform"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            stroke="currentColor"
          >
            <circle
              className="text-primary/20"
              strokeWidth="2"
              cx={size / 2}
              cy={size / 2}
              r={(size - 4) / 2}
            />
            <circle
              className="text-primary transition-[stroke-dashoffset] duration-300 ease-linear"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              cx={size / 2}
              cy={size / 2}
              r={(size - 4) / 2}
            />
          </svg>
          {children}
        </>
      );
      break;
    }

    case "fill": {
      const progressPercentage = currentFileState.progress;
      const topInset = 100 - progressPercentage;

      progressClassName = cn(
        "absolute inset-0 bg-primary/50 transition-[clip-path] duration-300 ease-linear",
        className,
      );
      progressStyle = {
        ...progressProps.style,
        clipPath: `inset(${topInset}% 0% 0% 0%)`,
      };
      progressChildren = children;
      break;
    }

    default:
      break;
  }

  return useRender({
    defaultTagName: "div",
    enabled: shouldRender,
    render,
    state: progressState,
    props: {
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": currentFileState.progress,
      "aria-valuetext": `${currentFileState.progress}%`,
      "aria-labelledby": itemContext.nameId,
      "data-slot": "file-upload-progress",
      ...progressProps,
      className: progressClassName,
      style: progressStyle,
      children: progressChildren,
    },
  });
}

interface FileUploadItemDeleteProps extends React.ComponentProps<"button"> {
  render?: RenderProp<{
    file: File;
    status: FileState["status"];
  }>;
}

function FileUploadItemDelete(props: FileUploadItemDeleteProps) {
  const { render, children, onClick: onClickProp, ...deleteProps } = props;

  const store = useStoreContext(ITEM_DELETE_NAME);
  const itemContext = useFileUploadItemContext(ITEM_DELETE_NAME);

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (!itemContext.fileState || event.defaultPrevented) return;

      store.dispatch({
        type: "REMOVE_FILE",
        file: itemContext.fileState.file,
      });
    },
    [store, itemContext.fileState, onClickProp],
  );

  const currentFileState =
    itemContext.fileState ??
    ({
      file: EMPTY_FILE,
      progress: 0,
      status: "idle",
    } satisfies FileState);

  return useRender({
    defaultTagName: "button",
    enabled: Boolean(itemContext.fileState),
    render,
    state: {
      file: currentFileState.file,
      status: currentFileState.status,
    },
    props: {
      type: "button",
      "aria-controls": itemContext.id,
      "aria-describedby": itemContext.nameId,
      "data-slot": "file-upload-item-delete",
      ...deleteProps,
      children,
      onClick,
    },
  });
}

interface FileUploadClearProps extends React.ComponentProps<"button"> {
  forceMount?: boolean;
  render?: RenderProp<{ disabled: boolean }>;
}

function FileUploadClear(props: FileUploadClearProps) {
  const { render, children, forceMount, disabled, onClick: onClickProp, ...clearProps } = props;

  const context = useFileUploadContext(CLEAR_NAME);
  const store = useStoreContext(CLEAR_NAME);
  const fileCount = useStore((state) => state.files.size);

  const isDisabled = disabled || context.disabled;

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClickProp?.(event);

      if (event.defaultPrevented) return;

      store.dispatch({ type: "CLEAR" });
    },
    [store, onClickProp],
  );

  const shouldRender = forceMount || fileCount > 0;

  return useRender({
    defaultTagName: "button",
    enabled: shouldRender,
    render,
    state: { disabled: isDisabled },
    props: {
      type: "button",
      "aria-controls": context.listId,
      "data-slot": "file-upload-clear",
      "data-disabled": isDisabled ? "" : undefined,
      ...clearProps,
      disabled: isDisabled,
      children,
      onClick,
    },
  });
}

export {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  type FileUploadProps,
  FileUploadTrigger,
  useStore as useFileUpload,
};
