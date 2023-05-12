import React from "react";
import { Header } from "../components/Header";
import { Dropzone } from "../components/Dropzone";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center ">
      <Header />
      <Dropzone />
    </main>
  );
}
