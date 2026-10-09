import http from '@/api/http';
import getFileContents from '@/api/server/files/getFileContents';
import loadDirectory from '@/api/server/files/loadDirectory';
import createServerBackup from '@/api/server/backups/createServerBackup';
import { ServerBackup } from '@/api/server/types';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesKey = (line: string, key: string): boolean => {
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(key)}\\s*=`);
    return pattern.test(line);
};

const writeFile = async (uuid: string, file: string, content: string): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/files/write`, content, {
        params: { file },
        headers: {
            'Content-Type': 'text/plain',
        },
    });
};

const fileExists = async (uuid: string, file: string): Promise<boolean> => {
    const lastSlash = file.lastIndexOf('/');
    const directory = lastSlash === -1 ? '/' : file.slice(0, lastSlash) || '/';
    const filename = lastSlash === -1 ? file : file.slice(lastSlash + 1);

    const files = await loadDirectory(uuid, directory);
    return files.some((item) => item.name === filename);
};

const readFile = async (uuid: string, file: string): Promise<string> => {
    try {
        return await getFileContents(uuid, file);
    } catch (error: any) {
        if (await fileExists(uuid, file)) {
            throw error;
        }

        await writeFile(uuid, file, '');
        return await getFileContents(uuid, file);
    }
};

export const addOrEditVariable = async (uuid: string, file: string, key: string, value: string): Promise<void> => {
    const content = await readFile(uuid, file);
    const lines = content.length > 0 ? content.split(/\r?\n/) : [];
    const newLine = `${key}=${value}`;

    const matchIndexes = lines.reduce<number[]>((acc, line, index) => {
        if (matchesKey(line, key)) {
            acc.push(index);
        }

        return acc;
    }, []);

    let updatedLines: string[];
    if (matchIndexes.length > 0) {
        const [first, ...duplicates] = matchIndexes;
        updatedLines = lines
            .map((line, index) => (index === first ? newLine : line))
            .filter((_, index) => !duplicates.includes(index));
    } else {
        updatedLines = [...lines, newLine];
    }

    await writeFile(uuid, file, updatedLines.join('\n'));
};

export const removeVariable = async (uuid: string, file: string, key: string): Promise<void> => {
    const content = await readFile(uuid, file);
    const lines = content.length > 0 ? content.split(/\r?\n/) : [];
    const updatedLines = lines.filter((line) => !matchesKey(line, key));

    await writeFile(uuid, file, updatedLines.join('\n'));
};

export const moveVariable = async (uuid: string, oldFile: string, newFile: string, key: string): Promise<void> => {
    const content = await readFile(uuid, oldFile);
    const lines = content.length > 0 ? content.split(/\r?\n/) : [];
    const matchIndex = lines.findIndex((line) => matchesKey(line, key));

    if (matchIndex === -1) {
        throw new Error(`Variable "${key}" was not found in ${oldFile}.`);
    }

    const line = lines[matchIndex]!;
    const value = line.slice(line.indexOf('=') + 1).trim();
    const remainingLines = lines.filter((_, index) => index !== matchIndex);

    await writeFile(uuid, oldFile, remainingLines.join('\n'));
    await addOrEditVariable(uuid, newFile, key, value);
};

export const createVariablesBackup = async (uuid: string, name?: string): Promise<ServerBackup> => {
    return createServerBackup(uuid, {
        name,
        ignored: '*\n!.env*',
        isLocked: false,
    });
};