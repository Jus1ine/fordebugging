<script lang="ts">
    import { onMount } from 'svelte';
    import { uploadedImages, type GalleryImage } from '$lib';
    import { goto } from '$app/navigation';
    import { userProfile } from '$lib';

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

    let showModal = false;
    let selectedFiles: File[] = [];
    let previewUrls: string[] = [];
    let showEditMode = false;
    let selectedImageForEdit: GalleryImage | null = null;
    let editedImageName = '';
    
    let filters: ImageFilters = {
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

    let isProfileOpen = false;

    function toggleModal() {
        showModal = !showModal;
        if (!showModal) {
            resetFileSelection();
        }
    }

    function resetFileSelection() {
        selectedFiles = [];
        previewUrls = [];
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            const newFiles = Array.from(input.files);
            addFiles(newFiles);
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer?.files) {
            const newFiles = Array.from(event.dataTransfer.files)
                .filter(file => file.type.startsWith('image/'));
            addFiles(newFiles);
        }
    }

    function addFiles(newFiles: File[]) {
        // Limit total files to 10
        const remainingSlots = Math.max(0, 10 - selectedFiles.length);
        const filesToAdd = newFiles.slice(0, remainingSlots);

        filesToAdd.forEach(file => {
            selectedFiles = [...selectedFiles, file];
            previewUrls = [...previewUrls, URL.createObjectURL(file)];
        });
    }

    function removeFile(index: number) {
        selectedFiles = selectedFiles.filter((_, i) => i !== index);
        previewUrls = previewUrls.filter((_, i) => i !== index);
    }

    function uploadImages() {
        if (selectedFiles.length === 0) return;

        selectedFiles.forEach(file => {
            uploadImage(file);
        });

        // Reset file selection after upload
        resetFileSelection();
        toggleModal();
    }

    function uploadImage(file: File) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const newImage: GalleryImage = {
                    id: Date.now(), // Unique ID
                    url: event.target?.result as string,
                    name: file.name,
                    timestamp: new Date().toISOString(),
                    comments: [] // Initialize empty comments array
                };

                // Add to store (which automatically syncs with localStorage)
                uploadedImages.update(imgs => [...imgs, newImage]);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    }

    function openEditMode(image: GalleryImage) {
        selectedImageForEdit = image;
        editedImageName = image.name; // Initialize with current image name
        showEditMode = true;
        resetFilters();
    }

    function closeEditMode() {
        showEditMode = false;
        selectedImageForEdit = null;
        resetFilters();
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

    function getFilterStyle(): string {
        return `
            filter: 
                brightness(${filters.brightness}%) 
                contrast(${filters.contrast}%) 
                saturate(${filters.saturation}%)
                blur(${filters.blur}px)
                hue-rotate(${filters.hue}deg)
                sepia(${filters.sepia}%)
                grayscale(${filters.grayscale}%)
                opacity(${100}%)
        `;
    }

    function saveEditedImage() {
        // Non-null assertion and type guard
        if (!selectedImageForEdit) {
            console.error('No image selected for editing');
            return;
        }

        try {
            // Create a canvas to apply filters
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.error('Could not get canvas context');
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous'; // Help with potential CORS issues
            img.src = selectedImageForEdit.url;

            img.onload = () => {
                // Set canvas size to match image
                canvas.width = img.width;
                canvas.height = img.height;

                // Apply filters using canvas
                ctx.filter = `
                    brightness(${filters.brightness}%) 
                    contrast(${filters.contrast}%) 
                    saturate(${filters.saturation}%)
                    blur(${filters.blur}px)
                    hue-rotate(${filters.hue}deg)
                    sepia(${filters.sepia}%)
                    grayscale(${filters.grayscale}%)
                `;

                // Draw the filtered image
                ctx.drawImage(img, 0, 0, img.width, img.height);

                // Convert canvas to data URL
                const filteredImageUrl = canvas.toDataURL('image/jpeg', 0.9);

                // Update the image in the images array
                uploadedImages.update(images => 
                    images.map(img => 
                        img.id === selectedImageForEdit!.id 
                            ? { 
                                ...img, 
                                name: editedImageName.trim() || img.name, // Use trimmed name or keep original
                                url: filteredImageUrl // Preserve the edited image URL
                            } 
                            : img
                    )
                );

                // Close edit mode
                closeEditMode();
            };

            img.onerror = (error) => {
                console.error('Error loading image:', error);
            };
        } catch (error) {
            console.error('Error in saveEditedImage:', error);
        }
    }

    function deleteImage(id: number) {
        uploadedImages.update(imgs => imgs.filter(img => img.id !== id));
    }

    function navigateToUrImage() {
        goto('/UrImage');
    }

    function toggleProfile() {
        isProfileOpen = !isProfileOpen;
    }

    function navigateToProfile() {
        goto('/Profile');
    }

    function navigateToGallery() {
        goto('/viewgallery');
    }

    // Consistent height generation function
    function getConsistentHeight(image: GalleryImage): number {
        // Use a combination of image properties to create a consistent seed
        const seed = image.url.length + (image.name?.length || 0) + image.id;
        
        // Define height ranges
        const minHeight = 250;
        const maxHeight = 450;
        
        // Use a simple deterministic method to generate height
        const height = minHeight + (seed % (maxHeight - minHeight));
        
        return height;
    }

    onMount(() => {});
</script>

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
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>Settings</span>
                        </button>

                        <button
                            on:click={() => {
                                // Add sign out logic here
                                goto('/');
                            }}
                            class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-3 text-red-500"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign Out</span>
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
                        on:click={() => showEditMode = false}
                        class="text-[#e09f3e] hover:text-[#e09f3e]/80 transition-colors rounded-full p-2 hover:bg-gray-100"
                        aria-label="Close edit mode"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                alt={selectedImageForEdit.name}
                                class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                style={getFilterStyle()}
                            >
                        </div>
                    </div>

                    <!-- Controls -->
                    <div class="w-80 border-l">
                        <div class="p-6 h-full overflow-y-auto">
                            <h3 class="text-lg font-medium mb-6" id="adjustments">Adjustments</h3>
                            
                            <!-- Basic Adjustments -->
                            <div class="mb-8">
                                <h4 class="text-sm font-medium text-gray-700 mb-4" id="basic-adjustments">Basic Adjustments</h4>
                                <div class="space-y-6">
                                    <div>
                                        <label for="brightness" class="flex justify-between mb-2">
                                            <span>Brightness</span>
                                            <span>{filters.brightness}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="brightness"
                                            min="0"
                                            max="200"
                                            bind:value={filters.brightness}
                                            class="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label for="contrast" class="flex justify-between mb-2">
                                            <span>Contrast</span>
                                            <span>{filters.contrast}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="contrast"
                                            min="0"
                                            max="200"
                                            bind:value={filters.contrast}
                                            class="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label for="saturation" class="flex justify-between mb-2">
                                            <span>Saturation</span>
                                            <span>{filters.saturation}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="saturation"
                                            min="0"
                                            max="200"
                                            bind:value={filters.saturation}
                                            class="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label for="blur" class="flex justify-between mb-2">
                                            <span>Blur</span>
                                            <span>{filters.blur}px</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="blur"
                                            min="0"
                                            max="10" 
                                            step="0.1"
                                            bind:value={filters.blur}
                                            class="w-full"
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
                                            <span>Hue</span>
                                            <span>{filters.hue}°</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="hue"
                                            min="0"
                                            max="360"
                                            bind:value={filters.hue}
                                            class="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label for="sepia" class="flex justify-between mb-2">
                                            <span>Sepia</span>
                                            <span>{filters.sepia}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="sepia"
                                            min="0"
                                            max="100"
                                            bind:value={filters.sepia}
                                            class="w-full"
                                        />
                                    </div>

                                    <div>
                                        <label for="grayscale" class="flex justify-between mb-2">
                                            <span>Grayscale</span>
                                            <span>{filters.grayscale}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            id="grayscale"
                                            min="0"
                                            max="100"
                                            bind:value={filters.grayscale}
                                            class="w-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Image Name -->
                            <div class="mb-8">
                                <h4 class="text-sm font-medium text-gray-700 mb-2">Image Name</h4>
                                <input
                                    type="text"
                                    bind:value={editedImageName}
                                    placeholder="Enter image name"
                                    class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e09f3e] focus:outline-none"
                                    aria-label="Image name"
                                />
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex gap-3">
                                <button 
                                    on:click={resetFilters}
                                    class="flex-1 px-4 py-2 text-sm font-medium text-[#e09f3e] border border-[#e09f3e] hover:bg-[#e09f3e]/10 rounded-md transition-colors"
                                >
                                    Reset
                                </button>
                                <button 
                                    on:click={saveEditedImage}
                                    class="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#e09f3e] rounded-md hover:bg-[#e09f3e]/90 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Gallery Grid -->
    {#if $uploadedImages.length === 0}
        <div class="text-center text-gray-500 py-8">
            <p>No images uploaded yet. Click the Upload button to add some!</p>
        </div>
    {:else}
        <div class="masonry-grid px-4 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {#each $uploadedImages as image (image.id)}
                <div 
                    class="relative group rounded-lg overflow-hidden bg-gray-100 break-inside-avoid" 
                    style="height: {getConsistentHeight(image)}px;"
                >
                    <img 
                        src={image.url} 
                        alt={image.name}
                        class="w-full h-full object-cover absolute top-0 left-0 transition-transform duration-300 group-hover:brightness-75"
                    />
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="flex gap-2">
                            <button 
                                on:click|stopPropagation={() => openEditMode(image)}
                                class="px-3 py-2 bg-white text-[#e09f3e] border border-[#e09f3e] rounded-lg hover:bg-[#e09f3e]/10 transition-colors duration-300 flex items-center gap-2 shadow-lg"
                            >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                                Edit
                            </button>
                            <button 
                                on:click|stopPropagation={() => goto(`/viewgallery?id=${image.id}`)}
                                class="px-3 py-2 bg-white text-[#e09f3e] border border-[#e09f3e] rounded-lg hover:bg-[#e09f3e]/10 transition-colors duration-300 flex items-center gap-2 shadow-lg"
                            >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                                View
                            </button>
                        </div>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="text-white text-sm font-semibold truncate max-w-[200px]">{image.name}</h3>
                                <p class="text-xs text-gray-300">{new Date(image.timestamp).toLocaleDateString()}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button 
                                    on:click={() => deleteImage(image.id)}
                                    class="bg-red-500/80 text-white p-2 rounded-full hover:bg-red-600 flex items-center justify-center transition-all duration-300 hover:scale-110"
                                    aria-label="Delete image"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

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