"use client";

import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "#/components/theme-provider";

const Toaster = ({ closeButton, icons, style, toastOptions, ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-6" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleXIcon className="size-6" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        close: <XIcon className="block size-6" />,
        ...icons,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--color-green-50)",
          "--success-border": "transparent",
          "--success-text": "var(--color-green-500)",
          "--error-bg": "var(--color-red-50)",
          "--error-border": "transparent",
          "--error-text": "var(--color-red-500)",
          "--border-radius": "6px",
          "--width": "295px",
          ...style,
        } as CSSProperties
      }
      closeButton={closeButton ?? true}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast:
            "cn-toast h-14! w-[295px]! gap-2! rounded-md! border-0! p-4! shadow-none! jp-label-md",
          success: "bg-green-50! text-green-500!",
          error: "bg-red-50! text-red-500!",
          icon: "m-0! size-6! shrink-0 text-current [&>svg]:m-0! [&>svg]:size-6!",
          content: "min-w-0 flex-1",
          title: "jp-label-md font-medium! leading-4! text-current",
          closeButton:
            "order-last ml-auto flex! size-6! shrink-0 items-center! justify-center! self-center! border-0! bg-transparent! p-0! leading-none! text-grey-900! opacity-100! shadow-none! [inset:auto]! [position:static]! [transform:none]! hover:bg-transparent!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
