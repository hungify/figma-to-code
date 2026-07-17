"use client";

import { ImagePlusIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "#/components/ui/button";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "#/components/ui/file-upload";

export function FileUploadShowcase() {
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-grey-900">
      <div className="grid gap-8">
        <section className="grid gap-4">
          <h2 className="text-xl font-bold">Upload image</h2>
          <div className="grid w-fit grid-cols-1 gap-8 md:grid-cols-2">
            <CoverImageUpload />
            <CoverImageUpload />
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-bold">Upload file</h2>
          <div className="grid w-fit grid-cols-1 gap-8 md:grid-cols-2">
            <DocumentUpload />
            <DocumentUpload />
          </div>
        </section>
      </div>
    </main>
  );
}

function CoverImageUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0];

  return (
    <FileUpload
      accept="image/*"
      maxFiles={1}
      value={files}
      onValueChange={setFiles}
      label="Cover image upload"
      className="w-[346px]"
    >
      {file ? (
        <>
          <FileUploadList forceMount>
            <FileUploadItem value={file} className="border-0 p-0">
              <FileUploadItemPreview className="aspect-[346/180] h-auto w-full rounded-lg border-0 bg-grey-100 [&>svg]:size-6" />
            </FileUploadItem>
          </FileUploadList>
          <FileUploadItemDeleteButton file={file}>Remove cover</FileUploadItemDeleteButton>
        </>
      ) : (
        <UploadDropzone showButton={false} />
      )}
    </FileUpload>
  );
}

function DocumentUpload() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <FileUpload
      maxFiles={1}
      value={files}
      onValueChange={setFiles}
      label="File upload"
      className="w-[346px]"
    >
      <UploadDropzone showButton />
      <FileUploadList>
        {files.map((file) => (
          <FileUploadItem
            key={`${file.name}-${file.lastModified}`}
            value={file}
            className="rounded-lg border-grey-100 p-2"
          >
            <FileUploadItemPreview className="h-9 w-16 rounded-lg border-0 bg-grey-100 [&>svg]:size-5 [&>svg]:text-grey-500" />
            <FileUploadItemMetadata className="jp-label-md" />
            <FileUploadItemDelete
              aria-label="Remove file"
              className="text-grey-900 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none"
            >
              <XIcon className="size-5" aria-hidden="true" strokeWidth={2} />
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
    </FileUpload>
  );
}

function UploadDropzone({ showButton }: { showButton: boolean }) {
  return (
    <FileUploadDropzone className="flex h-[180px] w-full flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-grey-100 bg-grey-50 px-4 py-9 hover:bg-grey-50 focus-visible:ring-3 focus-visible:ring-green-100 focus-visible:outline-none data-dragging:border-green-500 data-dragging:bg-green-50 data-invalid:border-red-500">
      <div className="flex w-full flex-col items-center gap-2">
        <ImagePlusIcon className="size-6 text-grey-500" aria-hidden="true" strokeWidth={2} />
        <p className="jp-label-md text-grey-400">Add cover image</p>
      </div>
      {showButton ? (
        <FileUploadTrigger
          render={
            <Button
              type="button"
              variant="outline"
              color="green"
              className="h-[38px] px-4 py-2.5 jp-label-md"
            >
              Choose Files
            </Button>
          }
        />
      ) : null}
    </FileUploadDropzone>
  );
}

function FileUploadItemDeleteButton({ children, file }: { children: ReactNode; file: File }) {
  return (
    <FileUploadList forceMount>
      <FileUploadItem value={file} className="border-0 p-0">
        <FileUploadItemDelete className="flex items-center gap-2 rounded-lg px-2 jp-label-md text-red-500 focus-visible:ring-3 focus-visible:ring-red-100 focus-visible:outline-none">
          <XIcon className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {children}
        </FileUploadItemDelete>
      </FileUploadItem>
    </FileUploadList>
  );
}
