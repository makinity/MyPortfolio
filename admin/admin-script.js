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
                // Fix pathing for admin view
                let displayUrl = item.image_url || '';
                if (displayUrl && !displayUrl.startsWith('http') && !displayUrl.startsWith('blob:') && !displayUrl.startsWith('data:')) {
                    displayUrl = '../' + displayUrl;
                }

                return `
                    <div class="card" style="padding: 1rem; position: relative;">
                        <img src="${displayUrl}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 0.5rem;" onerror="this.src='../assets/images/placeholder.png'">
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
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Image Source</label>
                    <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="sourceType" value="file" ${!isEdit ? 'checked' : ''}> File Upload
                        </label>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="sourceType" value="url" ${isEdit ? 'checked' : ''}> External URL
                        </label>
                    </div>
                </div>

                <div id="fileSourceGroup" class="form-group" style="display: ${!isEdit ? 'block' : 'none'};">
                    <label for="imgFile">Select Image File</label>
                    <input type="file" id="imgFile" accept="image/*" style="width: 100%; padding: 0.5rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
                </div>

                <div id="urlSourceGroup" class="form-group" style="display: ${isEdit ? 'block' : 'none'}; margin-top: 1rem;">
                    <label for="imgUrl">Image URL</label>
                    <input type="url" id="imgUrl" value="${isEdit ? item.image_url : ''}" placeholder="https://example.com/image.jpg" style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
                </div>

                <div class="form-group" style="margin-top: 1rem;">
                    <label for="imgCaption">Caption</label>
                    <textarea id="imgCaption" placeholder="Brief description..." style="width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); resize: vertical; min-height: 80px;">${isEdit ? item.caption : ''}</textarea>
                </div>
            </form>
        `;

        window.openModal(title, content, async () => {
            const sourceType = document.querySelector('input[name="sourceType"]:checked').value;
            const caption = document.getElementById('imgCaption').value;
            let imageUrl = '';

            if (sourceType === 'file') {
                const fileInput = document.getElementById('imgFile');
                const file = fileInput.files[0];
                
                if (!file && !isEdit) {
                    showToast('Please select a file to upload', true);
                    throw new Error('No file selected');
                }

                if (file) {
                    // Upload to Supabase Storage - matching your 'Gallery' bucket and folder structure
                    const fileName = `images/gallery/${Date.now()}-${file.name}`;
                    const { data: uploadData, error: uploadError } = await window.supabase.storage
                        .from('Gallery')
                        .upload(fileName, file);

                    if (uploadError) {
                        showToast('Upload failed: ' + uploadError.message, true);
                        throw uploadError;
                    }

                    // Get Public URL
                    const { data: urlData } = window.supabase.storage
                        .from('Gallery')
                        .getPublicUrl(fileName);
                    
                    imageUrl = urlData.publicUrl;
                } else if (isEdit) {
                    imageUrl = item.image_url; // Keep existing
                }
            } else {
                imageUrl = document.getElementById('imgUrl').value;
                if (!imageUrl) {
                    showToast('Image URL is required', true);
                    throw new Error('URL required');
                }
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
                showToast('Failed to save gallery item', true);
                throw error;
            }
        });

        // Toggle source groups
        const radios = document.querySelectorAll('input[name="sourceType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('fileSourceGroup').style.display = e.target.value === 'file' ? 'block' : 'none';
                document.getElementById('urlSourceGroup').style.display = e.target.value === 'url' ? 'block' : 'none';
            });
        });
    };

    const handleGalleryDelete = (id) => {
        const title = 'Confirm Deletion';
        const content = `
            <p>Are you sure you want to delete this gallery item? This action cannot be undone.</p>
        `;

        window.openModal(title, content, async () => {
            try {
                const { error } = await window.supabase
                    .from('gallery')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                showToast('Gallery item deleted');
                renderGallery(); 
            } catch (error) {
                console.error('Gallery delete error:', error);
                showToast('Failed to delete item', true);
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
