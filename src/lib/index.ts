import { writable } from 'svelte/store';
export interface Comment {
    id: number;
    text: string;
    userName: string;
    timestamp: string;
}
export interface GalleryImage {
    id: number;
    url: string;
    name: string;
    timestamp: string;
    comments: Comment[];
    likes?: string[]; // Array of usernames who liked the image
}
export const uploadedImages = writable<GalleryImage[]>([]);
export interface UserProfile {
    userName: string;
    profilePicture: string;
    moods: string[];
}
export const userProfile = writable<UserProfile>({
    userName: 'User',
    profilePicture: 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png',
    moods: ['Professional']
});