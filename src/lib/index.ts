import { writable } from 'svelte/store';

export interface Comment {
    id: number;
    text: string;
    userName: string;
    timestamp: number;
}

export interface GalleryImage {
    id: string;
    url: string;
    name: string;
    timestamp: number;
    comments: Comment[];
    likes?: string[]; // Array of usernames who liked the image
    userId: string;
    filters?: {
        brightness: number;
        contrast: number;
        saturation: number;
        sharpness: number;
        grain: number;
        blur: number;
        hue: number;
        sepia: number;
        grayscale: number;
    };
}

export const uploadedImages = writable<GalleryImage[]>([]);

export interface UserProfile {
    userName: string;
    profilePicture: string;
    moods: string[];
    aboutText: string;
    joinedDate: string;
}

export const userProfile = writable<UserProfile>({
    userName: 'User',
    profilePicture: 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png',
    moods: ['Professional'],
    aboutText: '',
    joinedDate: new Date().toISOString()
});