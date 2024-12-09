<script lang="ts">
    import { goto } from '$app/navigation';
    import { uploadedImages, type GalleryImage, type Comment } from '$lib';
    import { userProfile } from '$lib';
    import { onMount } from 'svelte';
    import { initializeApp, getApps, getApp } from "firebase/app";
    import { getDatabase, ref as dbRef, get, onChildAdded, onChildRemoved, onChildChanged, update, set, child } from "firebase/database";
    import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
    import { firebaseConfig } from "$lib/firebaseConfig";

    // Initialize Firebase
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getDatabase(app); 
    const auth = getAuth(app);

    let isProfileOpen = false;
    let selectedImage: GalleryImage | null = null;
    let newCommentText = '';
    $: comments = selectedImage?.comments || [];

    onMount(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                goto('/');
                return;
            }
            loadImages();
        });

        return () => {
            unsubscribe();
        };
    });

    async function loadImages() {
        console.group('Load Images Debug');
        try {
            const imagesRef = dbRef(db, 'images');
            const snapshot = await get(imagesRef);
            
            console.log('Images Snapshot:', {
                exists: snapshot.exists(),
                data: snapshot.val()
            });

            if (snapshot.exists()) {
                const data = snapshot.val();
                const images: GalleryImage[] = Object.keys(data)
                    .map(key => {
                        const imageData = data[key];
                        const image: GalleryImage = {
                            id: key,
                            url: imageData.base64,
                            name: imageData.name,
                            timestamp: imageData.timestamp,
                            userId: imageData.userId,
                            comments: imageData.comments || [], 
                            likes: imageData.likes || [],
                            filters: imageData.filters || {
                                brightness: 100,
                                contrast: 100,
                                saturation: 100,
                                sharpness: 100,
                                grain: 0,
                                blur: 0,
                                hue: 0,
                                sepia: 0,
                                grayscale: 0
                            }
                        };
                        
                        console.log(`Loaded Image ${key}:`, {
                            name: image.name,
                            urlLength: image.url ? image.url.substring(0, 50) + '...' : 'No URL',
                            timestamp: image.timestamp
                        });

                        return image;
                    })
                    .sort((a, b) => b.timestamp - a.timestamp);

                console.log('Total Images Loaded:', images.length);
                uploadedImages.set(images);
            } else {
                console.log('No images found');
                uploadedImages.set([]);
            }
            console.groupEnd();
        } catch (error) {
            console.error('Error loading images:', error);
            uploadedImages.set([]);
            alert('Failed to load images. Please check your connection.');
            console.groupEnd();
        }
    }

    // Real-time listeners for gallery updates
    onMount(() => {
        const imagesRef = dbRef(db, 'images');
        onChildAdded(imagesRef, (data) => {
            const newImage = data.val();
            uploadedImages.update(images => [...images, newImage]);
            console.log('Image added:', newImage);
        });

        onChildRemoved(imagesRef, (data) => {
            const removedImage = data.val();
            uploadedImages.update(images => images.filter(img => img.id !== removedImage.id));
            console.log('Image removed:', removedImage);
        });

        onChildChanged(imagesRef, (data) => {
            const changedImage = data.val();
            uploadedImages.update(images => images.map(img => img.id === changedImage.id ? { ...img, ...changedImage } : img));
            console.log('Image changed:', changedImage);
        });
        
        // Ensure that the image structure is consistent
        uploadedImages.subscribe(images => {
            console.log('Current Images:', images);
        });
    });

    function toggleProfile() {
        isProfileOpen = !isProfileOpen;
    }
    function handleProfileKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            toggleProfile();
        }
    }
    function openImageModal(image: GalleryImage) {
        selectedImage = image;
    }
    function closeImageModal() {
        selectedImage = null;
        newCommentText = '';
    }

    // Utility function to safely check likes with explicit typing
    function hasLikes(image: GalleryImage | null | undefined, username: string | null | undefined): boolean {
        // Comprehensive null and type checking
        if (!image || !image.likes || !username) return false;
        
        return Array.isArray(image.likes) && 
               typeof username === 'string' && 
               image.likes.includes(username);
    }

    // Function to toggle like on an image with Firebase database update
    async function toggleLike(imageId: string, event: MouseEvent) {
        console.log('Toggle Like Initiated:', {
            imageId,
            currentUser: auth.currentUser,
            userName: $userProfile.userName
        });

        event.stopPropagation(); // Prevent opening modal when clicking like button
        
        if (!auth.currentUser || !$userProfile.userName) {
            console.error('User not authenticated or profile not loaded');
            alert('Please log in to like images');
            return;
        }

        const userName = $userProfile.userName;
        const imageRef = dbRef(db, `images/${imageId}`);

        console.log('Attempting to retrieve image data for like:', { imageId });
        try {
            const snapshot = await get(imageRef);
            const imageData = snapshot.val();

            console.log('Image Data Retrieved for Like:', imageData);

            if (!imageData) {
                console.error('No image found with ID:', imageId);
                alert('Image not found');
                return;
            }

            const currentLikes = imageData.likes || [];
            const updatedLikes = currentLikes.includes(userName) 
                ? currentLikes.filter((like: string) => like !== userName)
                : [...currentLikes, userName];

            console.log('Likes Before Update:', currentLikes);
            console.log('Likes After Update:', updatedLikes);

            // Update the entire image data
            await update(imageRef, {
                ...imageData,
                likes: updatedLikes
            });

            console.log('Firebase Like Update Successful');

            // Update local state
            uploadedImages.update(images =>
                images.map(img =>
                    img.id === imageId 
                        ? { ...img, likes: updatedLikes }
                        : img
                )
            );

            // Update selected image if it's the one being liked
            if (selectedImage && selectedImage.id === imageId) {
                selectedImage = { ...selectedImage, likes: updatedLikes };
            }
            console.log('Like Updated Successfully:', { imageId, updatedLikes });
        } catch (error) {
            console.error('Error toggling like:', error);
            alert(`Failed to toggle like: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Function to add comment to an image with Firebase database update
    async function addComment() {
        console.log('Add Comment Initiated:', {
            selectedImage,
            commentText: newCommentText,
            currentUser: auth.currentUser,
            userName: $userProfile.userName
        });

        if (!selectedImage || !newCommentText.trim() || !auth.currentUser || !$userProfile.userName) {
            console.error('Invalid comment submission');
            alert('Please ensure you are logged in and have entered a comment');
            return;
        }

        const newComment: Comment = {
            id: Date.now(),
            text: newCommentText.trim(),
            userName: $userProfile.userName,
            timestamp: Date.now()
        };
        
        const imageId = selectedImage.id;
        const imageRef = dbRef(db, `images/${imageId}`);

        console.log('Attempting to retrieve image data for comment:', { imageId });
        try {
            const snapshot = await get(imageRef);
            const imageData = snapshot.val();

            console.log('Image Data for Comment Retrieved:', imageData);

            if (!imageData) {
                console.error('No image found with ID:', imageId);
                alert('Image not found');
                return;
            }

            const currentComments = imageData.comments || [];
            const updatedComments = [...currentComments, newComment];

            console.log('Comments Before Update:', currentComments);
            console.log('Comments After Update:', updatedComments);

            // Update the entire image data
            await update(imageRef, {
                ...imageData,
                comments: updatedComments
            });

            console.log('Firebase Comment Update Successful');

            // Update local state
            uploadedImages.update(images =>
                images.map(img => 
                    img.id === imageId 
                        ? { ...img, comments: updatedComments }
                        : img
                )
            );

            // Update selected image
            selectedImage = { ...selectedImage, comments: updatedComments };
            
            // Reset comment input
            newCommentText = '';
            console.log('Comment Added Successfully:', { imageId, newComment });
        } catch (error) {
            console.error('Error adding comment:', error);
            alert(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Function to share image
    function shareImage(image: GalleryImage, event: MouseEvent) {
        event.stopPropagation(); // Prevent opening modal when clicking share button
        if (navigator.share) {
            navigator.share({
                title: image.name || 'Shared Image',
                text: 'Check out this image from my gallery!',
                url: image.url
            }).catch(console.error);
        } else {
            // Fallback: Copy URL to clipboard
            navigator.clipboard.writeText(image.url)
                .then(() => alert('Image URL copied to clipboard!'))
                .catch(console.error);
        }
    }
    // Function to generate a consistent shape and aspect ratio for images
    function getImageShape(image: GalleryImage): { 
        containerClass: string, 
        imageClass: string 
    } {
        // Convert id to number, defaulting to 0 if conversion fails
        const idNumber = typeof image.id === 'string' 
            ? parseInt(image.id, 10) || 0 
            : image.id;
        
        // Ensure numeric values for seed calculation
        const urlLength = image.url.length || 0;
        const nameLength = image.name?.length || 0;
        
        // Calculate seed using numeric values
        const seed = urlLength + nameLength + idNumber;
        
        // Define different shape classes with Pinterest-like variations
        const shapeOptions = [
            // Vertical photo
            { 
                containerClass: 'aspect-[3/4]', // Vertical photo ratio
                imageClass: 'object-cover' 
            },
            // Horizontal photo
            { 
                containerClass: 'aspect-[16/9]', // Horizontal photo ratio
                imageClass: 'object-cover' 
            },
            // Square photo
            { 
                containerClass: 'aspect-square', // Square photo ratio
                imageClass: 'object-cover' 
            },
            // Standard photo
            { 
                containerClass: 'aspect-[4/3]', // Standard photo ratio
                imageClass: 'object-cover' 
            }
        ];
        
        // Use seed to consistently select a shape
        return shapeOptions[seed % shapeOptions.length];
    }
</script>
<div class="min-h-screen bg-white">
    <div class="container mx-auto p-4 relative">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-4">
                <img src="/Shiroi.png" alt="SHiROi Logo" class="h-20 w-auto" />
            </div>
            <div class="relative">
                <button 
                    on:click={toggleProfile}
                    class="flex items-center space-x-2 px-4 py-2 text-gray-800 rounded-lg hover:bg-gray-50 focus:outline-none"
                >
                    <img 
                        src={$userProfile.profilePicture} 
                        alt="Profile" 
                        class="w-8 h-8 rounded-full"
                    />
                    <span class="font-medium">{$userProfile.userName}</span>
                </button>
                {#if isProfileOpen}
                    <div class="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg py-2 z-50 border">
                        <div class="px-4 py-3 border-b">
                            <div class="flex items-center space-x-3">
                                <img 
                                    src={$userProfile.profilePicture} 
                                    alt="Profile" 
                                    class="w-10 h-10 rounded-full object-cover"
                                />
                                <div>
                                    <h3 class="text-sm font-semibold">{$userProfile.userName}</h3>
                                    <p class="text-xs text-gray-500">
                                        {$userProfile.moods.join(', ')}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div class="py-2">
                            <button
                                on:click={() => goto('/Profile')}
                                class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                            >
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 8" />
                                </svg>
                                <span>Profile</span>
                            </button>
                            <button
                                on:click={() => goto('/')}
                                class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                            >
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>View Gallery</span>
                            </button>
                            <button
                                on:click={() => goto('/Gallery')}
                                class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                            >
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Upload Gallery</span>
                            </button>
                            <div class="border-t my-2"></div>
                            <button
                                on:click={() => goto('/settings')}
                                class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3"
                            >
                                <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                </svg>
                                <span>Settings</span>
                            </button>
                            <button
                                on:click={async () => {
                                    await signOut(auth);
                                    goto('/');
                                }}
                                class="text-red-500 hover:bg-red-100 w-full text-left px-4 py-2"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
        <!-- Gallery Grid -->
        {#if $uploadedImages.length === 0}
            <div class="text-center text-gray-500 py-8">
                <p class="text-xl">No images in the gallery yet</p>
                <p class="mt-2">Upload some images to get started!</p>
            </div>
        {:else}
            <div class="masonry-grid">
                {#each $uploadedImages as image (image.id.toString())}
                    <div 
                        class="break-inside-avoid mb-4 relative group cursor-pointer"
                        on:click={() => openImageModal(image)}
                        on:keydown={(e) => e.key === 'Enter' && openImageModal(image)}
                        tabindex="0"
                        role="button"
                    >
                        <div class="relative">
                            <img 
                                src={image.url} 
                                alt={image.name} 
                                class="w-full rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105"
                            />
                            <div class="absolute top-2 right-2 flex items-center space-x-2">
                                <button 
                                    on:click|stopPropagation={(event: MouseEvent) => toggleLike(image.id.toString(), event)}
                                    class="bg-white/70 rounded-full p-2 hover:bg-white/90 transition"
                                >
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        class="h-5 w-5 {hasLikes(image, $userProfile.userName) ? 'text-red-500' : 'text-gray-500'}" 
                                        viewBox="0 0 20 20" 
                                        fill="currentColor"
                                    >
                                        <path 
                                            fill-rule="evenodd" 
                                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" 
                                            clip-rule="evenodd" 
                                        />
                                    </svg>
                                </button>
                                
                                <!-- New Comment Count Badge -->
                                <span class="bg-white/70 rounded-full px-2 py-1 text-xs font-bold text-gray-700 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clip-rule="evenodd" />
                                    </svg>
                                    {image.comments?.length || 0}
                                </span>
                            </div>
                        </div>
                        <div class="mt-2">
                            <h3 class="text-sm font-semibold text-gray-800">{image.name}</h3>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
<!-- Image Modal -->
{#if selectedImage}
    <div 
        class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-hidden"
        on:click|self={closeImageModal}
    >
        <div class="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] flex shadow-2xl overflow-hidden">
            <!-- Image Section -->
            <div class="w-2/3 bg-gray-100 flex items-center justify-center p-4">
                <img 
                    src={selectedImage?.url || ''} 
                    alt={selectedImage?.name || 'Gallery Image'} 
                    class="max-w-full max-h-[80vh] object-contain rounded-xl"
                />
            </div>
            
            <!-- Comments Section -->
            <div class="w-1/3 bg-white p-6 overflow-y-auto flex flex-col">
                <!-- Image Details -->
                <div class="mb-6 border-b pb-4">
                    <h2 class="text-xl font-bold mb-2">{selectedImage?.name || 'Untitled Image'}</h2>
                    <p class="text-gray-500 text-sm">
                        Uploaded on {selectedImage ? new Date(selectedImage.timestamp).toLocaleDateString() : ''}
                    </p>
                </div>
                <!-- Comments Header -->
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">
                        Comments 
                        <span class="text-gray-500 text-sm ml-2">({comments.length})</span>
                    </h3>
                </div>
                
                <!-- Comments List -->
                <div class="flex-1 space-y-4 mb-6 overflow-y-auto pr-2">
                    {#if comments.length > 0}
                        {#each comments as comment}
                            <div class="flex space-x-3">
                                <img 
                                    src={$userProfile.profilePicture} 
                                    alt="Profile" 
                                    class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                                <div>
                                    <div class="bg-gray-100 rounded-xl p-3">
                                        <p class="text-sm font-semibold mb-1">{comment.userName}</p>
                                        <p class="text-sm">{comment.text}</p>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">
                                        {new Date(comment.timestamp).toLocaleString('en-US', {
                                            month: 'short', 
                                            day: 'numeric', 
                                            hour: '2-digit', 
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                        {/each}
                    {:else}
                        <div class="text-center text-gray-500 py-8">
                            <p class="text-2xl mb-2">🤔</p>
                            <p>No comments yet</p>
                        </div>
                    {/if}
                </div>
                
                <!-- Add Comment -->
                <div class="mt-auto border-t pt-4">
                    <div class="flex items-center space-x-3 mb-3">
                        <img 
                            src={$userProfile.profilePicture} 
                            alt="Profile" 
                            class="w-8 h-8 rounded-full object-cover"
                        />
                        <p class="font-medium">{$userProfile.userName}</p>
                    </div>
                    <textarea 
                        bind:value={newCommentText}
                        placeholder="Add a comment..."
                        class="w-full p-3 border border-gray-300 rounded-xl mb-3 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        rows="3"
                    ></textarea>
                    <button 
                        on:click={addComment}
                        disabled={!newCommentText.trim()}
                        class="w-full bg-red-500 text-white py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Post Comment
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
<style>
    .masonry-grid {
        column-count: 1;
        column-gap: 1rem;
    }
    .masonry-item {
        break-inside: avoid;
        margin-bottom: 1rem;
    }
    @media (min-width: 640px) {
        .masonry-grid {
            column-count: 2;
        }
    }
    @media (min-width: 1024px) {
        .masonry-grid {
            column-count: 3;
        }
    }
    @media (min-width: 1280px) {
        .masonry-grid {
            column-count: 4;
        }
    }
</style>