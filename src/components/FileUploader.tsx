import { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onFileReady: (file: File) => void;
  isLoading?: boolean;
}

export function FileUploader({ onFileReady, isLoading = false }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (rawFile: File) => {
    setError(null);

    if (!ALLOWED_FILE_TYPES.some((type) => type === rawFile.type)) {
      setError('Hanya format JPG, PNG, atau PDF yang didukung.');
      return;
    }

    if (rawFile.size > MAX_FILE_SIZE) {
      setError('Ukuran berkas melebihi batas maksimal 10 MB.');
      return;
    }

    let finalFile = rawFile;

    // Compress image if JPG/PNG
    if (rawFile.type.startsWith('image/')) {
      try {
        setCompressing(true);
        const options = {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressedBlob = await imageCompression(rawFile, options);
        finalFile = new File([compressedBlob], rawFile.name, { type: rawFile.type });
      } catch (err) {
        console.warn('Image compression fallback to raw file:', err);
      } finally {
        setCompressing(false);
      }
    }

    setSelectedFile(finalFile);
    onFileReady(finalFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50/50'
            : selectedFile
            ? 'border-emerald-300 bg-emerald-50/20'
            : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={compressing || isLoading}
        />

        {compressing ? (
          <div className="flex flex-col items-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <span className="text-xs font-medium">Memampatkan gambar...</span>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mb-2" />
            <span className="text-xs font-semibold text-slate-800 break-all">
              {selectedFile.name}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Siap diunggah
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="mt-2 text-xs text-red-600 hover:text-red-700 h-6 px-2"
            >
              Ganti Berkas
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-2">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Klik untuk memilih atau seret berkas ke sini
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              JPG, PNG, atau PDF (Maks. 10 MB)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
