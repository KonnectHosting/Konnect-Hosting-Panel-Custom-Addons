import React, { useMemo } from 'react';
import { CloudDownloadIcon, CloudUploadIcon } from '@heroicons/react/solid';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { theme } from 'twin.macro';
import { useTranslation } from 'react-i18next';
import ChartBlock from '@/components/server/console/ChartBlock';
import TooltipElement from '@/components/elements/tooltip/Tooltip';
import { bytesToString, mbToBytes } from '@/lib/formatters';
import { hexToRgba } from '@/lib/helpers';
import { useServerGraphData } from '@/components/server/console/useServerGraphData';

interface ServerGraphsProps {
    withNetwork?: boolean;
}

const chartStyle = {
    left: '-11px',
    bottom: '-11px',
    width: 'calc(100% + 17px)',
    position: 'relative' as const,
    height: 200,
};

const tooltipStyles = {
    content: {
        backgroundColor: '#42425B',
        border: 'none',
        borderRadius: 5,
        color: '#B2B2C1',
        padding: '8px 10px',
    },
    label: {
        display: 'none',
    },
};

const valueFormatter = (value: number | string | Array<number | string>, unit?: string): string => {
    const next = Array.isArray(value) ? Number(value[0]) : Number(value);

    if (Number.isNaN(next)) {
        return '-';
    }

    return unit ? `${next}${unit}` : `${next}`;
};

const bytesFormatter = (value: number | string | Array<number | string>): string => {
    const next = Array.isArray(value) ? Number(value[0]) : Number(value);

    if (Number.isNaN(next)) {
        return '-';
    }

    return bytesToString(next);
};

const GraphChart = ({
    data,
    dataKey,
    stroke,
    fill,
    max,
    tooltipFormatter,
    yAxisFormatter,
}: {
    data: Array<Record<string, number | null>>;
    dataKey: string;
    stroke: string;
    fill: string;
    max?: number;
    tooltipFormatter: (value: number | string | Array<number | string>) => string;
    yAxisFormatter?: (value: number) => string;
}) => (
    <div style={chartStyle}>
        <ResponsiveContainer width={'100%'} height={'100%'}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id={`gradient-${dataKey}`} x1={'0'} y1={'0'} x2={'0'} y2={'1'}>
                        <stop offset={'5%'} stopColor={stroke} stopOpacity={0.5} />
                        <stop offset={'95%'} stopColor={fill} stopOpacity={0.25} />
                    </linearGradient>
                </defs>
                <YAxis hide domain={[0, max ?? 'auto']} tickFormatter={yAxisFormatter} allowDataOverflow={false} />
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey='name' hide />
                <Tooltip
                    formatter={tooltipFormatter}
                    contentStyle={tooltipStyles.content}
                    itemStyle={{ color: '#B2B2C1' }}
                    labelStyle={tooltipStyles.label}
                />
                <Area
                    type={'monotone'}
                    isAnimationActive={false}
                    dataKey={dataKey}
                    stroke={stroke}
                    fill={`url(#gradient-${dataKey})`}
                    strokeWidth={2}
                    connectNulls
                    dot={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

export default ({ withNetwork = true }: ServerGraphsProps) => {
    const { t } = useTranslation('arix/utilities');
    const { limits, points, stats } = useServerGraphData();

    const cpuData = useMemo(() => points.map((point) => ({ index: point.index, value: point.cpu })), [points]);
    const memoryData = useMemo(() => points.map((point) => ({ index: point.index, value: point.memory })), [points]);
    const networkData = useMemo(
        () =>
            points.map((point) => ({
                index: point.index,
                inbound: point.networkIn,
                outbound: point.networkOut,
            })),
        [points]
    );

    return (
        <>
            <ChartBlock
                title={t('cpu-usage')}
                type={'cpu'}
                limit={limits.cpu ? limits.cpu + '%' : '∞'}
                usage={`${stats.cpu.toFixed(2)}%`}
            >
                <GraphChart
                    data={cpuData}
                    dataKey={'value'}
                    stroke={'rgb(var(--primary))'}
                    fill={'rgb(var(--primary))'}
                    max={limits.cpu || undefined}
                    tooltipFormatter={(value) => valueFormatter(value, '%')}
                />
            </ChartBlock>

            <ChartBlock
                title={t('memory-usage')}
                type={'memory'}
                limit={limits.memory ? bytesToString(mbToBytes(limits.memory)) : '∞'}
                usage={bytesToString(stats.memory)}
            >
                <GraphChart
                    data={memoryData}
                    dataKey={'value'}
                    stroke={'rgb(var(--primary))'}
                    fill={'rgb(var(--primary))'}
                    max={limits.memory || undefined}
                    tooltipFormatter={bytesFormatter}
                />
            </ChartBlock>

            {withNetwork && (
                <ChartBlock
                    type={'network'}
                    title={t('inbound-outbound')}
                    inbound={`${bytesToString(stats.rx)}`}
                    outbound={`${bytesToString(stats.tx)}`}
                    legend={
                        <>
                            <TooltipElement arrow content={'Inbound'}>
                                <CloudDownloadIcon className={'mr-2 w-4 h-4 text-yellow-400'} />
                            </TooltipElement>
                            <TooltipElement arrow content={'Outbound'}>
                                <CloudUploadIcon className={'w-4 h-4 text-cyan-400'} />
                            </TooltipElement>
                        </>
                    }
                >
                    <div style={chartStyle}>
                        <ResponsiveContainer width={'100%'} height={'100%'}>
                            <AreaChart data={networkData}>
                                <defs>
                                    <linearGradient id={'gradient-network-inbound'} x1={'0'} y1={'0'} x2={'0'} y2={'1'}>
                                        <stop offset={'5%'} stopColor={theme('colors.yellow.400')} stopOpacity={0.5} />
                                        <stop
                                            offset={'95%'}
                                            stopColor={hexToRgba(theme('colors.yellow.700'), 0.5)}
                                            stopOpacity={0.25}
                                        />
                                    </linearGradient>
                                    <linearGradient
                                        id={'gradient-network-outbound'}
                                        x1={'0'}
                                        y1={'0'}
                                        x2={'0'}
                                        y2={'1'}
                                    >
                                        <stop offset={'5%'} stopColor={theme('colors.cyan.400')} stopOpacity={0.5} />
                                        <stop
                                            offset={'95%'}
                                            stopColor={hexToRgba(theme('colors.cyan.700'), 0.5)}
                                            stopOpacity={0.25}
                                        />
                                    </linearGradient>
                                </defs>
                                <YAxis
                                    hide
                                    tickFormatter={(value: number) => bytesToString(value)}
                                    allowDataOverflow={false}
                                />
                                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                                <XAxis dataKey='name' hide />
                                <Tooltip
                                    formatter={(value, name) => [
                                        bytesFormatter(value),
                                        name === 'inbound' ? 'Inbound' : 'Outbound',
                                    ]}
                                    contentStyle={tooltipStyles.content}
                                    labelStyle={tooltipStyles.label}
                                />
                                <Area
                                    type={'monotone'}
                                    isAnimationActive={false}
                                    dataKey={'inbound'}
                                    stroke={theme('colors.yellow.400')}
                                    fill={'url(#gradient-network-inbound)'}
                                    strokeWidth={2}
                                    connectNulls
                                    dot={false}
                                />
                                <Area
                                    type={'monotone'}
                                    isAnimationActive={false}
                                    dataKey={'outbound'}
                                    stroke={theme('colors.cyan.400')}
                                    fill={'url(#gradient-network-outbound)'}
                                    strokeWidth={2}
                                    connectNulls
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartBlock>
            )}
        </>
    );
};
