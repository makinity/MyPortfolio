document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.querySelectorAll('#navLinks .nav-link[data-page]');
    const contentArea = document.getElementById('adminContent');

    // Mobile Sidebar Toggle
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Function to show toast notification
    window.showToast = function(message, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.style.background = isError ? 'var(--danger)' : 'var(--success)';
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };

    // Load page content
    const loadPage = async (pageName) => {
        try {
            contentArea.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <p>Loading...</p>
                </div>
            `;
            
            // In a real app, this fetches HTML from the server. 
            // We use fetch to load the local html files from the pages folder.
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error('Page not found');
            
            const html = await response.text();
            contentArea.innerHTML = html;
            
            // Re-attach any form event listeners loaded from the new HTML
            attachFormListeners();
            
            // Page-specific initialization
            if (pageName === 'dashboard') {
                initDashboardCharts();
            } else if (pageName === 'manage-gallery') {
                initGalleryPage();
            }
            
        } catch (error) {
            contentArea.innerHTML = `
                <div class="card" style="text-align: center; color: var(--danger);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Error loading page</h3>
                    <p>Could not load ${pageName}.html</p>
                </div>
            `;
        }
    };

    // --- Gallery Management ---
    const initGalleryPage = async () => {
        const btnUpload = document.getElementById('btnUploadImage');
        if (btnUpload) {
            btnUpload.addEventListener('click', () => openGalleryModal('add'));
        }
        await renderGallery();
    };

    const renderGallery = async () => {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;

        try {
            const { data, error } = await window.supabase
                .from('gallery')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-secondary);">No images in gallery yet.</p>';
                return;
            }

            grid.innerHTML = data.map(item => {
                let displayUrl = item.image_url || '';
                
                // If it's a Supabase URL (starts with http), use it directly
                if (displayUrl.startsWith('http') || displayUrl.startsWith('blob:') || displayUrl.startsWith('data:')) {
                    // It's already a full URL
                } else {
                    // It's a local path like "assets/images/gallery/1.jpg"
                    // We need to ensure it reaches the root 'assets' folder from 'admin/admin.html'
                    
                    // Remove leading slash if present to normalize
                    let cleanPath = displayUrl.startsWith('/') ? displayUrl.substring(1) : displayUrl;
                    
                    // If it already starts with 'assets/', we just need to go up one level
                    if (cleanPath.startsWith('assets/')) {
                        displayUrl = '../' + cleanPath;
                    } else {
                        // If it's just "images/...", prepend "../assets/"
                        displayUrl = '../assets/' + cleanPath;
                    }
                }

                console.log(`Rendering Item ${item.id} with path:`, displayUrl);

                return `
                    <div class="card" style="padding: 1rem; position: relative;">
                        <img src="${displayUrl}" 
                             style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 0.5rem; background: #1e293b;" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="img-placeholder" style="display: none; width: 100%; height: 150px; background: #334155; border-radius: 6px; margin-bottom: 0.5rem; align-items: center; justify-content: center; flex-direction: column; color: var(--text-secondary); font-size: 0.75rem;">
                            <i class="fas fa-image" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                            <span>Image Not Found</span>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.caption}">${item.caption || 'No caption'}</p>
                        <div class="action-btns" style="justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                            <button class="btn-icon edit-gallery" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete delete-gallery" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            // Attach listeners to newly rendered buttons
            grid.querySelectorAll('.edit-gallery').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(i => i.id == id);
                    openGalleryModal('edit', item);
                });
            });

            grid.querySelectorAll('.delete-gallery').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleGalleryDelete(id);
                });
            });

        } catch (error) {
            console.error('Gallery fetch error:', error);
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--danger);">Failed to load gallery items.</p>';
        }
    };

    const openGalleryModal = (mode, item = null) => {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Edit Gallery Item' : 'Upload New Image';
        
        const content = `
            <form id="galleryForm" class="modal-form">
                <div class="form-group">
                    <label for="imgFile">${isEdit ? 'Replace Image (Optional)' : 'Select Image File'}</label>
                    <input type="file" id="imgFile" accept="image/*" style="width: 100%; padding: 0.5rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
                    ${isEdit ? '<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Leave empty to keep current image.</p>' : ''}
                </div>

                <div class="form-group" style="margin-top: 1.5rem;">
                    <label for="imgCaption">Caption</label>
                    <textarea id="imgCaption" placeholder="Brief description..." style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); resize: vertical; min-height: 80px;">${isEdit ? item.caption : ''}</textarea>
                </div>
            </form>
        `;

        window.openModal(title, content, async () => {
            const caption = document.getElementById('imgCaption').value;
            const fileInput = document.getElementById('imgFile');
            const file = fileInput.files[0];
            let imageUrl = isEdit ? item.image_url : '';

            // Handle File Upload if a file is selected
            if (file) {
                // If editing, try to delete the OLD file first
                if (isEdit && item.image_url && item.image_url.includes('storage/v1/object/public/Gallery/')) {
                    const pathParts = item.image_url.split('/Gallery/');
                    if (pathParts.length > 1) {
                        const oldFilePath = pathParts[1];
                        console.log('Cleaning up old file:', oldFilePath);
                        await window.supabase.storage
                            .from('Gallery')
                            .remove([oldFilePath]);
                    }
                }

                // Upload the NEW file
                const fileName = `images/gallery/${Date.now()}-${file.name}`;
                const { data: uploadData, error: uploadError } = await window.supabase.storage
                    .from('Gallery')
                    .upload(fileName, file);

                if (uploadError) {
                    showToast('Upload failed: ' + uploadError.message, true);
                    throw uploadError;
                }

                const { data: urlData } = window.supabase.storage
                    .from('Gallery')
                    .getPublicUrl(fileName);
                
                imageUrl = urlData.publicUrl;
            } else if (!isEdit) {
                showToast('Please select a file to upload', true);
                throw new Error('No file selected');
            }

            try {
                let result;
                if (isEdit) {
                    result = await window.supabase
                        .from('gallery')
                        .update({ image_url: imageUrl, caption: caption })
                        .eq('id', item.id);
                } else {
                    result = await window.supabase
                        .from('gallery')
                        .insert([{ image_url: imageUrl, caption: caption }]);
                }

                if (result.error) throw result.error;

                showToast(isEdit ? 'Gallery item updated!' : 'Image uploaded successfully!');
                renderGallery(); 
            } catch (error) {
                console.error('Gallery save error:', error);
                showToast('Save failed: ' + error.message, true);
                throw error;
            }
        });
    };

    const handleGalleryDelete = (id) => {
        const title = 'Confirm Deletion';
        const content = `
            <p>Are you sure you want to delete this gallery item? This will also remove the file from storage. This action cannot be undone.</p>
        `;

        window.openModal(title, content, async () => {
            try {
                // 1. Fetch the item first to get the image URL
                const { data: item, error: fetchError } = await window.supabase
                    .from('gallery')
                    .select('image_url')
                    .eq('id', id)
                    .single();

                if (fetchError) throw fetchError;

                // 2. If it's a Supabase storage URL, delete the file
                if (item.image_url && item.image_url.includes('storage/v1/object/public/Gallery/')) {
                    const pathParts = item.image_url.split('/Gallery/');
                    if (pathParts.length > 1) {
                        const filePath = pathParts[1];
                        await window.supabase.storage
                            .from('Gallery')
                            .remove([filePath]);
                    }
                }

                // 3. Delete from database
                const { error: dbError } = await window.supabase
                    .from('gallery')
                    .delete()
                    .eq('id', id);

                if (dbError) throw dbError;

                showToast('Gallery item and file deleted');
                renderGallery(); 
            } catch (error) {
                console.error('Gallery delete error:', error);
                showToast('Failed to delete item: ' + error.message, true);
                throw error;
            }
        });
        
        // Change the Save button text to Delete for this modal
        const saveBtn = document.getElementById('saveModal');
        if (saveBtn) {
            saveBtn.textContent = 'Delete';
            saveBtn.classList.add('btn-danger'); // Add a red style if needed
        }
    };

    // Modal Handling
    const adminModal = document.getElementById('adminModal');
    const closeModalBtn = document.getElementById('closeModal');
    const cancelModalBtn = document.getElementById('cancelModal');
    const saveModalBtn = document.getElementById('saveModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    window.openModal = function(title, contentHtml, onSaveCallback) {
        if (!adminModal) return;
        
        const btn = document.getElementById('saveModal');
        if (btn) {
            btn.textContent = 'Save';
            btn.className = 'btn btn-primary btn-sm';
            btn.disabled = false;
        }

        modalTitle.textContent = title;
        modalBody.innerHTML = contentHtml;
        adminModal.classList.add('show');
        
        const currentBtn = document.getElementById('saveModal');
        const newSaveBtn = currentBtn.cloneNode(true);
        currentBtn.parentNode.replaceChild(newSaveBtn, currentBtn);
        
        newSaveBtn.addEventListener('click', async () => {
            const originalText = newSaveBtn.innerHTML;
            newSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            newSaveBtn.disabled = true;

            try {
                if (onSaveCallback) await onSaveCallback();
                closeModal();
            } catch (error) {
                console.error('Modal action error:', error);
                // toast is handled in callback
            } finally {
                const finalBtn = document.getElementById('saveModal');
                if (finalBtn) {
                    finalBtn.innerHTML = originalText;
                    finalBtn.disabled = false;
                }
            }
        });
    };

    window.closeModal = function() {
        if (adminModal) adminModal.classList.remove('show');
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    // Mock form listener for Save buttons
    const attachFormListeners = () => {
        const forms = document.querySelectorAll('.mock-form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                btn.disabled = true;
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    showToast('Changes saved successfully!');
                }, 800);
            });
        });
    };

    // Chart Initialization (Mock Data)
    let dashboardCharts = []; // Keep track to destroy old ones
    const initDashboardCharts = () => {
        // Destroy existing charts to prevent memory leaks or overlay issues
        dashboardCharts.forEach(c => c.destroy());
        dashboardCharts = [];

        // Common Chart Defaults for Dark Theme
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';

        // 1. Line Chart (Views)
        const viewsCtx = document.getElementById('viewsChart');
        if (viewsCtx) {
            const viewsChart = new Chart(viewsCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Profile Views',
                        data: [65, 89, 120, 150, 130, 200],
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
            dashboardCharts.push(viewsChart);
        }

        // 2. Doughnut Chart (Tech Stack)
        const techCtx = document.getElementById('techChart');
        if (techCtx) {
            const techChart = new Chart(techCtx, {
                type: 'doughnut',
                data: {
                    labels: ['React', 'Laravel', 'C#', 'Python'],
                    datasets: [{
                        data: [4, 2, 1, 1],
                        backgroundColor: [
                            '#0ea5e9', // Blue
                            '#ef4444', // Red
                            '#22c55e', // Green
                            '#f59e0b'  // Yellow
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
            dashboardCharts.push(techChart);
        }
    };

    // Navigation Click Handler
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all
            navLinks.forEach(l => l.classList.remove('active'));
            // Add to clicked
            link.classList.add('active');
            
            // Load content
            const page = link.getAttribute('data-page');
            loadPage(page);
            
            // Close mobile sidebar
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Load default page (Dashboard)
    loadPage('dashboard');
});
