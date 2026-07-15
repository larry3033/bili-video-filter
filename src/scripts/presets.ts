import type { FilterParams } from './filter-engine';

export interface Preset {
    id: string;
    name: string;
    icon: string;
    desc: string;
    params: FilterParams;
}

export const PRESETS: Preset[] = [
    {
        id: 'movie',
        name: '电影',
        icon: '🎬',
        desc: '暗部提升·低饱和·微暖',
        params: {
            exposure: -5, contrast: 18, highlights: 5, shadows: 15,
            temperature: -8, saturation: -15, sharpness: 5, clarity: 10,
        },
    },
    {
        id: 'warm',
        name: '暖阳',
        icon: '☀️',
        desc: '暖色调·明亮·柔光',
        params: {
            exposure: 8, contrast: -5, highlights: 10, shadows: 5,
            temperature: -25, saturation: 8, sharpness: 0, clarity: -5,
        },
    },
    {
        id: 'cool',
        name: '冷冽',
        icon: '❄️',
        desc: '冷色调·高对比·锐利',
        params: {
            exposure: -5, contrast: 15, highlights: -5, shadows: 5,
            temperature: 25, saturation: -5, sharpness: 10, clarity: 15,
        },
    },
    {
        id: 'vintage',
        name: '复古',
        icon: '📜',
        desc: '褪色·暖黄·柔焦',
        params: {
            exposure: 5, contrast: -10, highlights: 15, shadows: 10,
            temperature: -15, saturation: -35, sharpness: -10, clarity: -15,
        },
    },
    {
        id: 'bw',
        name: '黑白',
        icon: '⚫',
        desc: '去色·高对比·层次分明',
        params: {
            exposure: 0, contrast: 20, highlights: 5, shadows: 10,
            temperature: 0, saturation: -100, sharpness: 20, clarity: 25,
        },
    },
    {
        id: 'sharp',
        name: '锐化',
        icon: '🔪',
        desc: '强锐化·纹理增强',
        params: {
            exposure: 0, contrast: 10, highlights: 0, shadows: 0,
            temperature: 0, saturation: 5, sharpness: 40, clarity: 30,
        },
    },
    {
        id: 'dehaze',
        name: '去雾',
        icon: '🌫️',
        desc: '通透·鲜艳·高对比',
        params: {
            exposure: -5, contrast: 25, highlights: -10, shadows: 15,
            temperature: -5, saturation: 18, sharpness: 15, clarity: 35,
        },
    },
    {
        id: 'reset',
        name: '原图',
        icon: '🔄',
        desc: '重置全部滤镜',
        params: {
            exposure: 0, contrast: 0, highlights: 0, shadows: 0,
            temperature: 0, saturation: 0, sharpness: 0, clarity: 0,
        },
    },
];
