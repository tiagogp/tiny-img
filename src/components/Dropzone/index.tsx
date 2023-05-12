"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import React, { DragEvent, useCallback, useState } from "react";
import { verifyFile } from "../../utils/verifyFile";
import ItemDropzone from "./ItemDropzone";
import useMediaQuery from "@/hooks/useMediaQuery";
import JSZip from "jszip";
import { Spinner } from "../Spinner";

export const Dropzone = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const matches = useMediaQuery("(max-width: 480px)");

  const handleFileSelect = (event: any) => {
    const files = Array.from(event.target.files as File[]).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files.slice(0, 30)]);
  };

  const handleFileDrop = (event: DragEvent<HTMLElement>) => {
    setIsDragging(false);

    const files = Object.values(event.dataTransfer.files).filter((item) =>
      verifyFile(item as File)
    );

    setSelectedFiles([...selectedFiles, ...files.slice(0, 30)]);
  };

  const handleDownload = async () => {
    const zip = new JSZip();

    await Promise.all(
      newFiles.map(async (file, index) => {
        zip.file(`${file.name}-${index}.jpg`, file);
      })
    );

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = "tinyimg.zip";
    downloadLink.click();
  };

  const dragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const dragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onDropCapture = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const deleteFile = (index: number) => {
    const newSelectedFiles = [...selectedFiles];
    newSelectedFiles.splice(index, 1);

    setSelectedFiles(newSelectedFiles);
  };

  const updateNewFiles = useCallback(
    (file: File) => {
      const newSelectedFiles = [...selectedFiles];
      const values = newSelectedFiles.find(
        (oldValues) => oldValues.name === file.name
      );

      if (values) {
        const correctNewFile = newSelectedFiles.filter((oldValues, i) =>
          oldValues.name === file.name ? { ...oldValues, ...values } : oldValues
        );

        setNewFiles(correctNewFile);
        return;
      }

      setNewFiles((prev) => [...prev, file]);
    },
    [selectedFiles]
  );

  return (
    <>
      <main
        onDropCapture={onDropCapture}
        onDragEnter={dragEnter}
        onDragLeave={dragLeave}
        onDrop={handleFileDrop}
        onDragOver={(event) => event.preventDefault()}
        className={`relative transition-all select-none flex flex-col justify-center items-center w-11/12 max-w-screen-lg py-4 sm:h-80 border rounded border-dashed ${
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
          onChange={(e) => handleFileSelect(e)}
          type="file"
          multiple
          className="opacity-0 z-0 w-full h-full absolute cursor-pointer"
          itemType="image/png"
        />
        <h3 className="font-semibold text-slate-700 text-sm md:text-base mt-5 text-center w-11/12">
          Drop your WebP, PNG or JPEG files here!
        </h3>
        <p className="text-slate-400 text-xs md:text-sm mt-1">
          Up to 30 image, max 100 MB each.
        </p>
      </main>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: selectedFiles.length > 0 ? 1 : 0,
        }}
        transition={{ duration: 0.5, type: "spring", bounce: 0 }}
        className={`transition-all flex flex-col  w-11/12 max-w-screen-lg mt-5 border rounded  px-4 max-h-[200px] xs:max-h-[300px] overflow-auto`}
      >
        {selectedFiles.map((item, index) => (
          <ItemDropzone
            index={index}
            key={`${item.name}-${index}`}
            file={item}
            deleteFile={deleteFile}
            isMobile={matches}
            setNewFiles={updateNewFiles}
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
          className={`disabled:bg-slate-200 disabled:text-gray-400 transition-all mt-5 flex items-center justify-center rounded font-medium py-2 px-6 bg-black hover:bg-black/90 text-white active:scale-[.97] active:translate-y-0.5
            `}
          disabled={
            selectedFiles.length === 0 ||
            newFiles.length !== selectedFiles.length
          }
        >
          {selectedFiles.length === 0 ||
            (newFiles.length !== selectedFiles.length && (
              <Spinner className="mr-1" />
            ))}
          download
        </motion.button>
      )}
    </>
  );
};
