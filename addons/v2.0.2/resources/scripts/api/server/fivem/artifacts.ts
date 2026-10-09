import http from "@/api/http";

export interface Artifact {
    id: string;
    releaseDate: string;
    downloadUrl: string;
    buildId: string;
}

export interface Artifacts {
    recommended: Artifact;
    optional: Artifact;
    allVersions: Record<string, Artifact>;
}

export default function getArtifacts(id: string): Promise<{ data: Artifacts }> {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/fivem/artifacts`)
            .then((response) => {
                const artifacts = response.data;
                resolve({ data: artifacts });
            })
            .catch(reject);
    });
}