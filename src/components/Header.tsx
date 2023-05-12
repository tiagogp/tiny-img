"use client";

import React from "react";
import Image from "next/image";

export const Header = () => {
  return (
    <header className="w-full flex justify-center items-center border-b border-slate-100 py-4 sticky h-20 top-0 mb-10 bg-white shadow-test z-10">
      <main className="w-full max-w-screen-lg px-6">
        <Image src="/logo.svg" alt="logo" width={100} height={24} />
      </main>
    </header>
  );
};
