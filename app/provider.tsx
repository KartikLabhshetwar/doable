'use client';

import { ThemeProvider } from "next-themes";
import { ReactQueryProvider } from "@/lib/react-query";


export function Provider(props: { children?: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark">
      <ReactQueryProvider>
        {props.children}
      </ReactQueryProvider>
    </ThemeProvider>
  );
}