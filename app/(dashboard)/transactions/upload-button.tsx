import { useCSVReader } from "react-papaparse";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { normalizeNigerianBankCSV } from "@/lib/csv-utils";

type Props = {
  onUpload: (results: any) => void;
};

export const UploadButton = ({ onUpload }: Props) => {
  const { CSVReader } = useCSVReader();

  return (
    <CSVReader
      onUploadAccepted={(results: any) => {
        // Intercept and normalize the data
        const headers = results.data[0];
        const rows = results.data.slice(1);
        
        // Convert array of arrays to array of objects for easier processing
        const formattedData = rows.map((row: any[]) => {
          let obj: any = {};
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index];
          });
          return obj;
        });

        const normalizedData = normalizeNigerianBankCSV(formattedData);

        // Convert back to the format the table expects
        const newHeaders = Object.keys(normalizedData[0] || {});
        const finalResults = {
          data: [
            newHeaders,
            ...normalizedData.map(row => newHeaders.map(h => row[h]))
          ]
        };

        onUpload(finalResults);
      }}
    >
      {({ getRootProps }: any) => (
        <Button size="sm" className="w-full lg:w-auto" {...getRootProps()}>
          <Upload className="size-4 mr-2" />
          Import
        </Button>
      )}
    </CSVReader>
  );
};