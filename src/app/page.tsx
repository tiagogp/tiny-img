import { Dropzone } from "@/components/Dropzone";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center ">
      <Header />
      <Dropzone />
    </main>
  );
}
