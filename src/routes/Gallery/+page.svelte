<script lang="ts">
    import { onMount } from "svelte";
    import { initializeApp, getApps, getApp } from "firebase/app";
    import { getDatabase, ref as dbRef, push, set, update, get, child, onChildAdded, onChildRemoved, remove } from "firebase/database";
    import { uploadedImages, type GalleryImage, userProfile } from '$lib';
    import { goto } from '$app/navigation';
    import { firebaseConfig } from "$lib/firebaseConfig";
    import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
    import { get as getStore } from 'svelte/store';

    // Initialize Firebase
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getDatabase(app);
    const auth = getAuth(app);

    interface ImageFilters {
        brightness: number;
        contrast: number;
        saturation: number;
        sharpness: number;
        grain: number;
        blur: number;
        hue: number;
        sepia: number;
        grayscale: number;
    }

    let showModal: boolean = false;
    let selectedFiles: File[] = [];
    let previewUrls: string[] = [];
    let showEditMode: boolean = false;
    let selectedImageForEdit: GalleryImage | null = null;
    let editedImageName: string = '';
    let uploadProgress: number = 0;
    let isUploading: boolean = false;
    let isProfileOpen: boolean = false;

    // Default filters configuration
    let filters: NonNullable<GalleryImage['filters']> = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        sharpness: 100,
        grain: 0,
        blur: 0,
        hue: 0,
        sepia: 0,
        grayscale: 0
    };

    onMount(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                goto('/');
                return;
            }
            loadImages();

            // Real-time listener for new images
            const imagesRef = dbRef(db, 'images');
            const unsubscribeChildAdded = onChildAdded(imagesRef, (snapshot) => {
                const newImage = snapshot.val();
                const newImageWithId = {
                    id: snapshot.key || '',
                    url: newImage.base64,
                    name: newImage.name,
                    timestamp: newImage.timestamp,
                    userId: newImage.userId,
                    comments: newImage.comments || [], // Add empty comments array if not present
                    likes: newImage.likes || [], // Add empty likes array if not present
                    filters: newImage.filters || {
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
                uploadedImages.update(images => [newImageWithId, ...images]);
            });

            const unsubscribeChildRemoved = onChildRemoved(imagesRef, (snapshot) => {
                uploadedImages.update(images => 
                    images.filter(img => img.id !== snapshot.key)
                );
            });

            return () => {
                unsubscribeChildAdded();
                unsubscribeChildRemoved();
                unsubscribe();
            };
        });
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

    async function uploadImages() {
        if (!selectedFiles.length || !auth.currentUser) {
            console.error('No files selected or user not authenticated');
            return;
        }

        isUploading = true;
        uploadProgress = 0;
        const totalFiles = selectedFiles.length;
        let completedUploads = 0;

        try {
            // Use Promise.all to upload multiple images concurrently
            const uploadPromises = selectedFiles.map(async (file) => {
                return new Promise<void>((resolve, reject) => {
                    const reader = new FileReader();
                    
                    reader.onload = async (event) => {
                        try {
                            const base64Image = event.target?.result as string;
                            const timestamp = Date.now();

                            console.log('Uploading file:', {
                                name: file.name,
                                size: file.size,
                                type: file.type
                            });

                            // Create a reference to a new location in the database
                            const imageRef = push(dbRef(db, 'images'));

                            // Save the base64 image to the database
                            await set(imageRef, {
                                base64: base64Image,
                                name: file.name,
                                timestamp: timestamp,
                                userId: auth.currentUser?.uid,
                                comments: [], // Initialize empty comments array
                                likes: [], // Initialize empty likes array
                                filters: {
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
                            });

                            console.log('Image uploaded successfully:', imageRef.key);
                            completedUploads++;
                            uploadProgress = Math.floor((completedUploads / totalFiles) * 100);
                            resolve();
                        } catch (uploadError) {
                            console.error('Error during image upload:', uploadError);
                            reject(uploadError);
                        }
                    };

                    reader.onerror = (error) => {
                        console.error('FileReader error:', error);
                        reject(error);
                    };

                    // Start reading the file
                    reader.readAsDataURL(file);
                });
            });

            // Wait for all uploads to complete
            await Promise.all(uploadPromises);

            // Reset upload state
            showModal = false;
            selectedFiles = [];
            previewUrls = [];
            
            // Reload images to confirm upload
            await loadImages();

            // Show success message
            alert(`Successfully uploaded ${totalFiles} image(s)!`);
        } catch (error) {
            console.error('Overall upload error:', error);
            alert('Failed to upload images. Please try again.');
        } finally {
            isUploading = false;
            uploadProgress = 0;
        }
    }

    async function saveEditedImage(): Promise<void> {
        console.group(' Save Edited Image - Comprehensive Debug');
        
        // Extensive logging of current state
        console.log('Current Selected Image:', selectedImageForEdit);
        console.log('Current Filters:', filters);
        console.log('Edited Image Name:', editedImageName);

        if (!selectedImageForEdit) {
            console.error(' No image selected for editing');
            alert('Please select an image to edit');
            console.groupEnd();
            return;
        }

        if (!auth.currentUser) {
            console.error(' User not authenticated');
            alert('You must be logged in to edit images');
            console.groupEnd();
            return;
        }

        if (!editedImageName || editedImageName.trim() === '') {
            console.error(' Image name cannot be empty');
            alert('Please enter a valid image name');
            console.groupEnd();
            return;
        }

        try {
            // Safely handle potential null case with optional chaining
            const imageId = selectedImageForEdit?.id;
            if (!imageId) {
                throw new Error('Invalid image ID');
            }

            const imageRef = dbRef(db, `images/${imageId}`);
            
            // Prepare update data with both name and filters
            const updateData: GalleryImage = {
                ...selectedImageForEdit,
                name: editedImageName.trim(), // Ensure name is updated
                url: selectedImageForEdit.url, // Ensure base64 image is preserved
                filters: {
                    brightness: filters.brightness,
                    contrast: filters.contrast,
                    saturation: filters.saturation,
                    sharpness: filters.sharpness,
                    grain: filters.grain,
                    blur: filters.blur,
                    hue: filters.hue,
                    sepia: filters.sepia,
                    grayscale: filters.grayscale
                }
            };

            console.log(' Updating image with data:', updateData);

            // Update the image in Firebase
            await set(imageRef, {
                base64: updateData.url,
                name: updateData.name, // Explicitly set the new name
                timestamp: selectedImageForEdit?.timestamp ?? Date.now(),
                userId: selectedImageForEdit?.userId,
                comments: selectedImageForEdit?.comments || [],
                likes: selectedImageForEdit?.likes || [],
                filters: updateData.filters
            });

            // Update the local store to reflect the name change
            uploadedImages.update(images => 
                images.map(img => 
                    img.id === imageId 
                        ? {
                            ...img, 
                            name: updateData.name, 
                            filters: updateData.filters
                          } 
                        : img
                )
            );

            console.log(' Image updated successfully');
            
            // Explicitly reset all edit-related state
            selectedImageForEdit = null;
            editedImageName = '';
            
            // Reset filters to default
            filters = {
                brightness: 100,
                contrast: 100,
                saturation: 100,
                sharpness: 100,
                grain: 0,
                blur: 0,
                hue: 0,
                sepia: 0,
                grayscale: 0
            };

            console.log(' Edit mode closed and state reset');
            console.groupEnd();
        } catch (error) {
            console.error(' Error updating image:', error);
            alert('Failed to save image changes. Please try again.');
            console.groupEnd();
        }
    }

    // Reactive statement to control edit mode
    $: {
        // Ensure showEditMode is always correctly set
        if (selectedImageForEdit === null) {
            showEditMode = false;
        }
    }

    // Reactive statement to update filters in real-time
    $: if (selectedImageForEdit && filters) {
        console.log(' Reactive Filter Update:', {
            brightness: filters.brightness,
            contrast: filters.contrast,
            saturation: filters.saturation,
            sepia: filters.sepia,
            grayscale: filters.grayscale,
            hue: filters.hue,
            blur: filters.blur
        });

        selectedImageForEdit = {
            ...selectedImageForEdit,
            filters: {
                brightness: filters.brightness,
                contrast: filters.contrast,
                saturation: filters.saturation,
                sharpness: filters.sharpness,
                grain: filters.grain,
                blur: filters.blur,
                hue: filters.hue,
                sepia: filters.sepia,
                grayscale: filters.grayscale
            }
        };
    }

    // Reactive statement to update image name in real-time
    $: {
        // Only proceed if selectedImageForEdit is not null
        if (selectedImageForEdit && editedImageName) {
            // Create a temporary updated image with current name
            const updatedImage: GalleryImage = {
                ...selectedImageForEdit,
                name: editedImageName.trim()
            };

            // Update the images in the store to reflect current name
            uploadedImages.update(images => 
                images.map(img => 
                    img.id === selectedImageForEdit?.id ? updatedImage : img
                )
            );
        }
    }

    // Reactive statement to update gallery images in real-time
    $: {
        // Only proceed if both selectedImageForEdit and filters are defined
        if (selectedImageForEdit && filters) {
            // Create a temporary updated image with current filters
            const updatedImage: GalleryImage = {
                ...selectedImageForEdit,
                filters: {
                    brightness: filters.brightness,
                    contrast: filters.contrast,
                    saturation: filters.saturation,
                    sharpness: filters.sharpness,
                    grain: filters.grain,
                    blur: filters.blur,
                    hue: filters.hue,
                    sepia: filters.sepia,
                    grayscale: filters.grayscale
                }
            };

            // Update the images in the store to reflect current filters
            uploadedImages.update(images => 
                images.map(img => 
                    img.id === selectedImageForEdit?.id ? updatedImage : img
                )
            );
        }
    }

    // Modify openEditMode to ensure type safety
    function openEditMode(image: GalleryImage) {
        console.log(' Opening Edit Mode for Image:', image);

        // Ensure a deep copy of the image is created
        selectedImageForEdit = { ...image };
        editedImageName = image.name;
        
        // Reset filters to the image's current filters or default values
        filters = {
            brightness: image.filters?.brightness ?? 100,
            contrast: image.filters?.contrast ?? 100,
            saturation: image.filters?.saturation ?? 100,
            sharpness: image.filters?.sharpness ?? 100,
            grain: image.filters?.grain ?? 0,
            blur: image.filters?.blur ?? 0,
            hue: image.filters?.hue ?? 0,
            sepia: image.filters?.sepia ?? 0,
            grayscale: image.filters?.grayscale ?? 0
        };

        console.log(' Initial Filters:', filters);
        showEditMode = true;
    }

    function getImageFilterStyle(image: GalleryImage) {
        const filters = image.filters ?? {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sepia: 0,
            grayscale: 0,
            hue: 0,
            blur: 0,
            sharpness: 100,
            grain: 0
        };

        return `
            filter: 
            brightness(${filters.brightness}%) 
            contrast(${filters.contrast}%) 
            saturate(${filters.saturation}%)
            sepia(${filters.sepia}%)
            grayscale(${filters.grayscale}%)
            hue-rotate(${filters.hue}deg)
            blur(${filters.blur / 10}px)
        `;
    }

    // Preview filter style for edit modal
    function getFilterStyle() {
        return `
            filter: 
            brightness(${filters.brightness}%) 
            contrast(${filters.contrast}%) 
            saturate(${filters.saturation}%)
            sepia(${filters.sepia}%)
            grayscale(${filters.grayscale}%)
            hue-rotate(${filters.hue}deg)
            blur(${filters.blur / 10}px)
        `;
    }

    function toggleModal() {
        showModal = !showModal;
        if (!showModal) {
            resetFileSelection();
        }
    }

    function resetFileSelection() {
        selectedFiles = [];
        previewUrls = [];
        uploadProgress = 0;
        isUploading = false;
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            selectedFiles = Array.from(input.files);
            previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer?.files) {
            selectedFiles = Array.from(event.dataTransfer.files);
            previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
        }
    }

    function toggleProfile() {
        isProfileOpen = !isProfileOpen;
    }

    function removeFile(index: number) {
        selectedFiles.splice(index, 1);
        previewUrls.splice(index, 1);
    }

    function resetFilters() {
        filters = {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sharpness: 100,
            grain: 0,
            blur: 0,
            hue: 0,
            sepia: 0,
            grayscale: 0
        };
    }

    function getConsistentHeight(image: GalleryImage) {
        return 200; // Placeholder value
    }

    async function deleteImage(imageId: string): Promise<void> {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            // Remove from Firebase
            const imageRef = dbRef(db, `images/${imageId}`);
            await remove(imageRef);

            // Update local state
            uploadedImages.update(images => 
                images.filter(img => img.id !== imageId)
            );

            console.log('Image deleted successfully:', imageId);
        } catch (error) {
            console.error('Error deleting image:', error);
            alert('Failed to delete image. Please try again.');
        }
    }
</script>

<!-- Keep your existing template code unchanged -->
<div class="container mx-auto p-4 relative">
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-4">
                <img src="/Shiroi.png" alt="SHiROi Logo" class="h-20 w-auto" />
            </div>
            <button 
                on:click={toggleModal}
                class="px-4 py-2 bg-white text-[#e09f3e] border border-[#e09f3e] rounded-lg hover:bg-[#e09f3e]/10 transition-colors duration-300 flex items-center space-x-2"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Upload Images
            </button>
        </div>
        
        <!-- Profile Dropdown -->
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
                            on:click={() => goto('/viewgallery')}
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
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.572-1.065c-.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

    <!-- Upload Modal -->
    {#if showModal}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div 
                class="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
                on:dragover|preventDefault
                on:drop|preventDefault={(event: DragEvent) => handleDrop(event)}
                role="region"
                aria-label="Image upload dropzone"
            >
                <!-- Modal Header -->
                <div class="p-4 border-b flex justify-between items-center">
                    <h2 class="text-xl font-semibold" id="modal-title">Upload Images</h2>
                    <button 
                        on:click={toggleModal}
                        class="text-[#e09f3e] hover:text-[#e09f3e]/80 transition-colors rounded-full p-2 hover:bg-gray-100"
                        aria-label="Close upload modal"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Drag and Drop / File Input Area -->
                <div class="p-6 flex-grow overflow-y-auto">
                    <div 
                        class="border-2 border-dashed rounded-lg p-6 text-center transition-colors 
                        {selectedFiles.length > 0 ? 'border-[#e09f3e] bg-[#e09f3e]/10' : 'border-gray-300 hover:border-[#e09f3e]'}"
                    >
                        {#if selectedFiles.length === 0}
                            <label for="fileInput" class="block mb-4 text-gray-600">
                                Drag & drop images here or click to select
                            </label>
                            <input
                                type="file"
                                id="fileInput"
                                accept="image/*"
                                multiple
                                on:change={handleFileSelect}
                                class="hidden"
                            />
                            <button
                                on:click={() => document.getElementById('fileInput')?.click()}
                                class="px-4 py-2 bg-[#e09f3e] text-white rounded-md hover:bg-[#e09f3e]/90"
                                aria-label="Select images to upload"
                            >
                                Select Images
                            </button>
                        {:else}
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {#each previewUrls as preview, index}
                                    <div class="relative">
                                        <img 
                                            src={preview} 
                                            alt={`Preview ${index + 1}`} 
                                            class="w-full h-32 object-cover rounded"
                                        />
                                        <button 
                                            on:click={() => removeFile(index)}
                                            class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                                            aria-label={`Remove image ${index + 1}`}
                                        >
                                            ×
                                        </button>
                                    </div>
                                {/each}
                                {#if selectedFiles.length < 10}
                                    <div class="relative">
                                        <label 
                                            for="fileInput" 
                                            class="flex items-center justify-center w-full h-32 border-2 border-dashed rounded cursor-pointer hover:bg-gray-50"
                                        >
                                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                            </svg>
                                        </label>
                                        <input
                                            type="file"
                                            id="fileInput"
                                            accept="image/*"
                                            multiple
                                            on:change={handleFileSelect}
                                            class="hidden"
                                        />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="p-4 border-t flex justify-end gap-3">
                    <button 
                        on:click={toggleModal}
                        class="px-4 py-2 text-[#e09f3e] border border-[#e09f3e] hover:bg-[#e09f3e]/10 rounded-md transition-colors duration-300"
                    >
                        Cancel
                    </button>
                    <button 
                        on:click={uploadImages}
                        disabled={selectedFiles.length === 0}
                        class="px-4 py-2 bg-[#e09f3e] text-white hover:bg-[#e09f3e]/90 rounded-md transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Upload {selectedFiles.length} Image{selectedFiles.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Edit Mode -->
    {#if showEditMode && selectedImageForEdit}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg w-[90vw] max-w-5xl h-[90vh] flex flex-col">
                <!-- Header -->
                <div class="flex justify-between items-center p-4 border-b">
                    <h2 class="text-xl font-semibold" id="edit-mode-title">Edit Image</h2>
                    <button 
                        on:click={() => {
                            selectedImageForEdit = null;
                            showEditMode = false;
                        }}
                        class="text-gray-600 hover:text-gray-900"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Content -->
                <div class="flex flex-1 overflow-hidden">
                    <!-- Image Preview -->
                    <div class="flex-1 bg-[#f8f9fa] p-6 overflow-hidden">
                        <div class="w-full h-full flex items-center justify-center">
                            <img 
                                src={selectedImageForEdit.url} 
                                alt="Edit Preview" 
                                style={getFilterStyle()}
                                class="max-w-full max-h-full object-contain"
                            />
                        </div>
                    </div>

                    <div class="w-80 border-l">
                        <div class="p-6 h-full overflow-y-auto">
                            <h3 class="text-lg font-medium mb-6" id="adjustments">Adjustments</h3>
                            
                            <!-- Image Name Input -->
                            <div class="mb-4">
                                <label for="imageName" class="block text-sm font-medium text-gray-700 mb-2">Image Name</label>
                                <input 
                                    type="text" 
                                    id="imageName"
                                    bind:value={editedImageName}
                                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e09f3e]"
                                    placeholder="Enter image name"
                                />
                            </div>

                            <!-- Basic Adjustments -->
                            <div class="mb-8">
                                <h4 class="text-sm font-medium text-gray-700 mb-4" id="basic-adjustments">Basic Adjustments</h4>
                                <div class="space-y-6">
                                    <!-- Brightness Slider -->
                                    <div>
                                        <label for="brightness" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Brightness</span>
                                            <span class="text-sm text-gray-600">{filters.brightness}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="brightness"
                                            min="0" 
                                            max="200" 
                                            bind:value={filters.brightness}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <!-- Contrast Slider -->
                                    <div>
                                        <label for="contrast" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Contrast</span>
                                            <span class="text-sm text-gray-600">{filters.contrast}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="contrast"
                                            min="0" 
                                            max="200" 
                                            bind:value={filters.contrast}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <!-- Saturation Slider -->
                                    <div>
                                        <label for="saturation" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Saturation</span>
                                            <span class="text-sm text-gray-600">{filters.saturation}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="saturation"
                                            min="0" 
                                            max="200" 
                                            bind:value={filters.saturation}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Color Adjustments -->
                            <div class="mb-8">
                                <h4 class="text-sm font-medium text-gray-700 mb-4" id="color-adjustments">Color Adjustments</h4>
                                <div class="space-y-6">
                                    <div>
                                        <label for="hue" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Hue Rotation</span>
                                            <span class="text-sm text-gray-600">{filters.hue}°</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="hue"
                                            min="0" 
                                            max="360" 
                                            bind:value={filters.hue}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <label for="sepia" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Sepia</span>
                                            <span class="text-sm text-gray-600">{filters.sepia}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="sepia"
                                            min="0" 
                                            max="100" 
                                            bind:value={filters.sepia}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <label for="grayscale" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Grayscale</span>
                                            <span class="text-sm text-gray-600">{filters.grayscale}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="grayscale"
                                            min="0" 
                                            max="100" 
                                            bind:value={filters.grayscale}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Advanced Adjustments -->
                            <div class="mb-8">
                                <h4 class="text-sm font-medium text-gray-700 mb-4" id="advanced-adjustments">Advanced Adjustments</h4>
                                <div class="space-y-6">
                                    <div>
                                        <label for="blur" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Blur</span>
                                            <span class="text-sm text-gray-600">{filters.blur}px</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="blur"
                                            min="0" 
                                            max="20" 
                                            bind:value={filters.blur}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <label for="sharpness" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Sharpness</span>
                                            <span class="text-sm text-gray-600">{filters.sharpness}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="sharpness"
                                            min="0" 
                                            max="200" 
                                            bind:value={filters.sharpness}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <label for="grain" class="flex justify-between mb-2">
                                            <span class="text-sm text-gray-600">Grain</span>
                                            <span class="text-sm text-gray-600">{filters.grain}%</span>
                                        </label>
                                        <input 
                                            type="range" 
                                            id="grain"
                                            min="0" 
                                            max="100" 
                                            bind:value={filters.grain}
                                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer with Save and Cancel Buttons -->
                <div class="p-4 border-t flex justify-end gap-3">
                    <button 
                        on:click={() => {
                            selectedImageForEdit = null;
                            showEditMode = false;
                        }}
                        class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors duration-300"
                    >
                        Cancel
                    </button>
                    <button 
                        on:click={() => {
                            saveEditedImage();
                            selectedImageForEdit = null;
                            showEditMode = false;
                        }}
                        class="px-4 py-2 bg-[#e09f3e] text-white rounded-md hover:bg-[#c98a2a] transition-colors duration-300"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Gallery Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {#if $uploadedImages.length === 0}
            <div class="col-span-full text-center text-gray-500 py-8">
                <p>No images uploaded yet. Click the Upload button to add some!</p>
            </div>
        {:else}
            {#each $uploadedImages as image (image.id)}
                <div 
                    class="relative group overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                    <!-- Image with dynamic filters -->
                    <img 
                        src={image.url} 
                        alt={image.name}
                        style={getImageFilterStyle(image)}
                        class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    
                    <!-- Overlay -->
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                        <div class="flex space-x-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <!-- Edit Button -->
                            <button 
                                on:click={() => openEditMode(image)}
                                class="bg-white text-[#e09f3e] p-3 rounded-full hover:bg-[#e09f3e] hover:text-white transition-all duration-300"
                                aria-label="Edit image"
                            >
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                            </button>
                            
                            <!-- View Button -->
                            <button 
                                on:click={() => goto(`/viewgallery?id=${image.id}`)}
                                class="bg-white text-[#e09f3e] p-3 rounded-full hover:bg-[#e09f3e] hover:text-white transition-all duration-300"
                                aria-label="View image"
                            >
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            </button>
                            
                            <!-- Delete Button -->
                            <button 
                                on:click={() => deleteImage(image.id)}
                                class="bg-white text-red-500 p-3 rounded-full hover:bg-red-500 hover:text-white transition-all duration-300"
                                aria-label="Delete image"
                            >
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Image Details -->
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-semibold truncate max-w-[200px]">{image.name}</h3>
                                <p class="text-xs opacity-75">{new Date(image.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <style>
        /* Responsive grid layout */
        @media (max-width: 640px) {
            .grid {
                grid-template-columns: repeat(1, 1fr);
            }
        }
        @media (min-width: 640px) {
            .grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (min-width: 768px) {
            .grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }
        @media (min-width: 1024px) {
            .grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }
    </style>
</div>