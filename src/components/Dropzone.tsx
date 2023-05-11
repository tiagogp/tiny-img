"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React, { ChangeEventHandler, useState } from "react";

const convertSizeFileAndUnit = (fileSize: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = fileSize;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const verifyFile = (file: File) => {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];

  return validTypes.includes(file.type);
};

export const Dropzone = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileSelect = (event: any) => {
    const files = Array.from(event.target.files as File[]).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleFileDrop = (event: any) => {
    event.preventDefault();
    console.log();
    const files = Object.values(event.dataTransfer.files as File[]).filter(
      (item) => verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleFileUpload = () => {
    // handle file upload logic here
    console.log(selectedFiles);
  };

  return (
    <>
      <main
        onDrop={handleFileDrop}
        onDragOver={(event) => event.preventDefault()}
        className="transition-all select-none flex flex-col justify-center items-center w-11/12 max-w-screen-lg  h-80 border border-slate-300 bg-slate-50/50 rounded border-dashed"
      >
        <Image
          src="/upload.svg"
          alt="upload"
          width={100}
          height={100}
          className="h-20 w-20 md:w-auto md:h-auto"
          priority
        />
        <input
          onChange={handleFileSelect}
          type="file"
          multiple
          className="hidden"
          itemType="image/png"
        />
        <h3 className="font-semibold text-slate-700 text-sm md:text-base mt-5 text-center w-11/12">
          Drop your WebP, PNG or JPEG files here!
        </h3>
        <p className="text-slate-400 text-xs md:text-sm mt-1">
          Up to 50 image, max 10 MB each.
        </p>
      </main>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: selectedFiles.length > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.5, type: "spring", bounce: 0 }}
        className="transition-all flex flex-col justify-center items-center w-full max-w-screen-lg mt-5 border rounded py-4"
      >
        <div className="mt-2">
          {selectedFiles.map(({ name, size }) => (
            <div
              key={name}
              className="text-slate-400 text-sm flex flex-wrap justify-between"
            >
              {name}
              {convertSizeFileAndUnit(size)}
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
};
