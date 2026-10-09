import loadDirectory from "@/api/server/files/loadDirectory";
import deleteFiles from "@/api/server/files/deleteFiles";
import http from "@/api/http";

interface VersionRequest {
  uuid: string;
  id: string;
  engine: string;
  version: string;
  uninstall?: boolean;
}

const setVersion = async ({
  uuid,
  id,
  engine,
  version,
  uninstall,
}: VersionRequest): Promise<any> => {
    try {
        if (uninstall) {
            const files = await loadDirectory(uuid, "/");

            const fileNames = files
                .filter((file) => file.name !== "server.properties")
                .map((file) => file.name);

        if (fileNames.length > 0) {
            await deleteFiles(uuid, "/", fileNames);
            }
        }

        const response = await http.post(
            `/api/client/${id}/versions/${engine}/${version}`,
        );
        return response.data;
    } catch (error) {
        throw new Error(
            `Version installation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
};

export default setVersion;
