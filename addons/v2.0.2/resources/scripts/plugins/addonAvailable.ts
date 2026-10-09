import { ApplicationStore } from "@/state";
import { useStoreState } from "easy-peasy";

export default (addon: string, nestId: number, eggId: number) => {
    const addons = useStoreState((state: ApplicationStore) => state.settings.data!.addons);
    const config = addons[addon as keyof typeof addons] as { enabled: boolean; nests?: number[]; eggs?: number[] };
    const { enabled, nests = [], eggs = [] } = config;

    if (!enabled) return false;
    if (nests.length > 0 && !nests.includes(nestId)) return false;
    if (eggs.length > 0 && !eggs.includes(eggId)) return false;

    return true;
}