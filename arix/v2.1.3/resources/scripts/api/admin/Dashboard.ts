import http from '@/api/http';

export interface DashboardSettings {
    dashboardWidgets: string[];
}

export default function getDashboard(): Promise<DashboardSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/dashboard')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateDashboard(payload: DashboardSettings): Promise<DashboardSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/dashboard', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
