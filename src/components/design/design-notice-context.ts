"use client";

import { createContext } from "react";

export const DesignNoticeContext = createContext<(message: string, title?: string) => void>(() => {});
