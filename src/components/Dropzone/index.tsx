"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React, { useState } from "react";
import { verifyFile } from "../../utils/verifyFile";
import imageCompression from "browser-image-compression";
import { ItemDropzone } from "./ItemDropzone";

interface IFile extends File {
  oldSize: number;
}

export const Dropzone = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (event: any) => {
    const files = Array.from(event.target.files as File[]).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleFileDrop = (event: any) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Object.values(event.dataTransfer.files as File[]).filter(
      (item) => verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleDownload = async () => {
    const compressedFiles = await Promise.all(
      selectedFiles.map((file) =>
        imageCompression(file, {
          maxSizeMB: 50,
          maxWidthOrHeight: 1920,
        })
      )
    );

    compressedFiles.forEach((compressedFile, index) => {
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(compressedFile);
      downloadLink.download = `tinyimg-${compressedFile}-${index}.jpg`;
      downloadLink.click();
    });
  };

  const dragEnter = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const dragLeave = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onDropCapture = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const updateSelectedFiles = (
    index: number,
    newValues: {
      newFile: File;
    }
  ) => {
    const newSelectedFiles = [...selectedFiles];
    newSelectedFiles.filter((oldValues, i) =>
      i === index ? { ...oldValues, ...newValues } : oldValues
    );

    setSelectedFiles(newSelectedFiles);
  };

  const deleteFile = (index: number) => {
    const newSelectedFiles = [...selectedFiles];
    newSelectedFiles.splice(index, 1);

    setSelectedFiles(newSelectedFiles);
  };

  return (
    <>
      <main
        onDropCapture={onDropCapture}
        onDragEnter={dragEnter}
        onDragLeave={dragLeave}
        onDrop={handleFileDrop}
        onDragOver={(event) => event.preventDefault()}
        className={` transition-all select-none flex flex-col justify-center items-center w-11/12 max-w-screen-lg  h-80 border rounded border-dashed ${
          isDragging
            ? "border-blue-400 bg-blue-100/50"
            : "border-slate-300 bg-slate-50/50"
        }`}
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
        className="transition-all flex flex-col  w-11/12 max-w-screen-lg mt-5 border rounded  px-4  "
      >
        {selectedFiles.map((item, index) => (
          <ItemDropzone
            index={index}
            key={`${item.name}-${index}`}
            file={item}
            deleteFile={deleteFile}
            updateSelectedFiles={updateSelectedFiles}
          />
        ))}
      </motion.div>

      {selectedFiles.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{
            opacity: selectedFiles.length > 0 ? 1 : 0,
          }}
          transition={{ duration: 0.5, type: "spring", bounce: 0 }}
          onClick={handleDownload}
          className={`transition-all mt-5 flex items-center justify-center rounded font-medium py-2 px-6 bg-black hover:bg-black/90 text-white active:scale-[.97] active:translate-y-0.5
            `}
          disabled={selectedFiles.length === 0}
        >
          download
        </motion.button>
      )}
    </>
  );
};
