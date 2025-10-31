'use client';

import { ThemeProvider } from "next-themes";
import { ReactQueryProvider } from "@/lib/react-query";
import { Toaster } from "@/components/ui/sonner";


export function Provider(props: { children?: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark">
      <ReactQueryProvider>
        {props.children}
        <Toaster />
      </ReactQueryProvider>
    </ThemeProvider>
  );
}