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
            } else if (pageName === 'manage-projects') {
                initProjectsPage();
            } else if (pageName === 'manage-expertise-tech') {
                initTechStackPage();
            } else if (pageName === 'manage-expertise-sideskills') {
                initSideSkillsPage();
            } else if (pageName === 'manage-identity-profile') {
                initProfilePage();
            } else if (pageName === 'manage-identity-socials') {
                initSocialLinksPage();
            } else if (pageName === 'manage-expertise-specialty') {
                initSpecialtyPage();
            } else if (pageName === 'manage-expertise-facts') {
                initQuickFactsPage();
            } else if (pageName === 'manage-system-messages') {
                initMessagesPage();
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

    let currentGalleryPage = 1;
    let currentProjectsPage = 1;
    let currentTechPage = 1;
    const adminPageSize = 10;

    // --- Gallery Management ---
    const initGalleryPage = async (page = 1) => {
        currentGalleryPage = page;
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

            // Pagination Logic
            const totalItems = data.length;
            const totalPages = Math.ceil(totalItems / adminPageSize);
            const startIndex = (currentGalleryPage - 1) * adminPageSize;
            const paginatedData = data.slice(startIndex, startIndex + adminPageSize);

            grid.innerHTML = paginatedData.map(item => {
                let displayUrl = item.image_url || '';
                if (!(displayUrl.startsWith('http') || displayUrl.startsWith('blob:') || displayUrl.startsWith('data:'))) {
                    let cleanPath = displayUrl.startsWith('/') ? displayUrl.substring(1) : displayUrl;
                    displayUrl = cleanPath.startsWith('assets/') ? '../' + cleanPath : '../assets/' + cleanPath;
                }

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

            // Add Pagination Controls
            let paginationHtml = `
                <div class="pagination-controls" style="grid-column: 1/-1; display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Showing ${startIndex + 1} to ${Math.min(startIndex + adminPageSize, totalItems)} of ${totalItems} items
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm" id="prevGallery" ${currentGalleryPage === 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button class="btn btn-sm" id="nextGallery" ${currentGalleryPage === totalPages ? 'disabled' : ''}>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', paginationHtml);

            document.getElementById('prevGallery')?.addEventListener('click', () => initGalleryPage(currentGalleryPage - 1));
            document.getElementById('nextGallery')?.addEventListener('click', () => initGalleryPage(currentGalleryPage + 1));

            // Attach listeners
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
                    <input type="file" id="imgFile" accept="image/*" style="width: 100%; padding: 0.5rem; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary);">
                    ${isEdit ? '<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">Leave empty to keep current image.</p>' : ''}
                </div>

                <div class="form-group" style="margin-top: 1.5rem;">
                    <label for="imgCaption">Caption</label>
                    <textarea id="imgCaption" placeholder="Brief description..." style="width: 100%; padding: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); resize: vertical; min-height: 80px;">${isEdit ? item.caption : ''}</textarea>
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

    // --- Projects Management ---
    const initProjectsPage = async (page = 1) => {
        currentProjectsPage = page;
        const btnAdd = document.getElementById('addProjectBtn');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => openProjectModal('add'));
        }
        await renderProjects();
    };

    const renderProjects = async () => {
        const tbody = document.getElementById('projectsList');
        if (!tbody) return;

        try {
            const { data, error } = await window.supabase
                .from('projects')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No projects found.</td></tr>';
                return;
            }

            // Pagination Logic
            const totalItems = data.length;
            const totalPages = Math.ceil(totalItems / adminPageSize);
            const startIndex = (currentProjectsPage - 1) * adminPageSize;
            const paginatedData = data.slice(startIndex, startIndex + adminPageSize);

            tbody.innerHTML = paginatedData.map(project => {
                let displayUrl = project.image_url || '';
                if (!(displayUrl.startsWith('http') || displayUrl.startsWith('blob:') || displayUrl.startsWith('data:'))) {
                    let cleanPath = displayUrl.startsWith('/') ? displayUrl.substring(1) : displayUrl;
                    displayUrl = cleanPath.startsWith('assets/') ? '../' + cleanPath : '../assets/' + cleanPath;
                }

                return `
                    <tr>
                        <td><img src="${displayUrl}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px; background: #1e293b;" onerror="this.src='../assets/images/gallery/placeholder.jpg'"></td>
                        <td><strong>${project.title}</strong></td>
                        <td>${Array.isArray(project.tags) ? project.tags.join(', ') : (project.tags || '')}</td>
                        <td>${project.sort_order}</td>
                        <td>
                            <div class="action-btns">
                                <button class="btn-icon edit-project" data-id="${project.id}" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="btn-icon delete delete-project" data-id="${project.id}" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Add Pagination Controls
            let paginationHtml = `
                <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Showing ${startIndex + 1} to ${Math.min(startIndex + adminPageSize, totalItems)} of ${totalItems} projects
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm" id="prevProjects" ${currentProjectsPage === 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button class="btn btn-sm" id="nextProjects" ${currentProjectsPage === totalPages ? 'disabled' : ''}>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
            const existingPagination = document.querySelector('.pagination-controls');
            if (existingPagination) existingPagination.remove();
            
            const cardElement = tbody.closest('.card');
            if (cardElement) {
                cardElement.insertAdjacentHTML('afterend', paginationHtml);
            }

            document.getElementById('prevProjects')?.addEventListener('click', () => initProjectsPage(currentProjectsPage - 1));
            document.getElementById('nextProjects')?.addEventListener('click', () => initProjectsPage(currentProjectsPage + 1));

            // Listeners
            tbody.querySelectorAll('.edit-project').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(p => String(p.id) === String(id));
                    if (item) openProjectModal('edit', item);
                });
            });

            tbody.querySelectorAll('.delete-project').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleProjectDelete(id);
                });
            });

        } catch (error) {
            console.error('Render projects error:', error);
            showToast('Failed to load projects', true);
        }
    };

    const openProjectModal = (mode, item = null) => {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Edit Project' : 'Add New Project';
        
        const tagsString = isEdit && Array.isArray(item.tags) ? item.tags.join(', ') : (item?.tags || '');

        const content = `
            <div class="form-group">
                <label>Project Title</label>
                <input type="text" id="projTitle" value="${isEdit ? item.title : ''}" placeholder="e.g. Portfolio V1">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="projDesc" rows="3" placeholder="Briefly describe the project">${isEdit ? item.description : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" id="projTags" value="${tagsString}" placeholder="e.g. React, Supabase, Tailwind">
            </div>
            <div class="form-group">
                <label>Sort Order</label>
                <input type="number" id="projOrder" value="${isEdit ? item.sort_order : '0'}">
            </div>
            <div class="form-group">
                <label>Project Image</label>
                <input type="file" id="projFile" accept="image/*">
                ${isEdit ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">Keep current image if empty</p>` : ''}
            </div>
        `;

        window.openModal(title, content, async () => {
            const projTitle = document.getElementById('projTitle').value;
            const projDesc = document.getElementById('projDesc').value;
            const projTags = document.getElementById('projTags').value.split(',').map(t => t.trim()).filter(t => t !== '');
            const projOrder = parseInt(document.getElementById('projOrder').value) || 0;
            const fileInput = document.getElementById('projFile');
            const file = fileInput.files[0];
            
            let imageUrl = isEdit ? item.image_url : '';

            try {
                if (file) {
                    // Upload new image
                    const fileName = `images/project/${Date.now()}-${file.name}`;
                    const { error: upErr } = await window.supabase.storage
                        .from('Gallery')
                        .upload(fileName, file);
                    
                    if (upErr) throw upErr;

                    const { data: urlData } = window.supabase.storage
                        .from('Gallery')
                        .getPublicUrl(fileName);
                    
                    // Delete old image only AFTER new one is uploaded successfully
                    if (isEdit && item.image_url && item.image_url.includes('storage/v1/object/public/Gallery/')) {
                        const pathParts = item.image_url.split('/Gallery/');
                        if (pathParts.length > 1) {
                            await window.supabase.storage.from('Gallery').remove([pathParts[1]]);
                        }
                    }
                    
                    imageUrl = urlData.publicUrl;
                } else if (!isEdit) {
                    showToast('Please select an image', true);
                    throw new Error('Image required');
                }

                const projectData = {
                    title: projTitle,
                    description: projDesc,
                    tags: projTags,
                    sort_order: projOrder,
                    image_url: imageUrl
                };

                console.log('Saving project data:', projectData);

                let res;
                if (isEdit) {
                    res = await window.supabase.from('projects').update(projectData).eq('id', item.id);
                } else {
                    res = await window.supabase.from('projects').insert([projectData]);
                }

                if (res.error) throw res.error;

                showToast(`Project ${isEdit ? 'updated' : 'added'} successfully`);
                renderProjects();

            } catch (error) {
                console.error('Project save error:', error);
                showToast('Failed to save project: ' + error.message, true);
                throw error;
            }
        });
    };

    const handleProjectDelete = async (id) => {
        const title = 'Confirm Deletion';
        const content = `<p>Are you sure you want to delete this project? This will also remove the image from storage.</p>`;

        window.openModal(title, content, async () => {
            try {
                const { data: item } = await window.supabase.from('projects').select('image_url').eq('id', id).single();

                if (item?.image_url && item.image_url.includes('storage/v1/object/public/Gallery/')) {
                    const pathParts = item.image_url.split('/Gallery/');
                    if (pathParts.length > 1) {
                        await window.supabase.storage.from('Gallery').remove([pathParts[1]]);
                    }
                }

                const { error } = await window.supabase.from('projects').delete().eq('id', id);
                if (error) throw error;

                showToast('Project deleted');
                renderProjects();
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete project', true);
                throw error;
            }
        });

        const btn = document.getElementById('saveModal');
        if (btn) {
            btn.textContent = 'Delete';
            btn.classList.add('btn-danger');
        }
    };

    // --- Core Tech Stack ---
    const initTechStackPage = async (page = 1) => {
        currentTechPage = page;
        const btnAdd = document.getElementById('addTechBtn');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => openTechStackModal('add'));
        }
        await renderTechStack();
    };

    const renderTechStack = async () => {
        const tbody = document.getElementById('techStackList');
        if (!tbody) return;

        try {
            const { data, error } = await window.supabase
                .from('tech_stack')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No tech stack items found.</td></tr>';
                return;
            }

            // Pagination Logic
            const totalItems = data.length;
            const totalPages = Math.ceil(totalItems / adminPageSize);
            const startIndex = (currentTechPage - 1) * adminPageSize;
            const paginatedData = data.slice(startIndex, startIndex + adminPageSize);

            tbody.innerHTML = paginatedData.map(tech => `
                <tr>
                    <td><i class="${tech.icon_url}" style="margin-right: 1rem; width: 20px;"></i> <strong>${tech.name}</strong></td>
                    <td><code>${tech.icon_url}</code></td>
                    <td>${tech.sort_order}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon edit-tech" data-id="${tech.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete delete-tech" data-id="${tech.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Add Pagination Controls
            let paginationHtml = `
                <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Showing ${startIndex + 1} to ${Math.min(startIndex + adminPageSize, totalItems)} of ${totalItems} items
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm" id="prevTech" ${currentTechPage === 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button class="btn btn-sm" id="nextTech" ${currentTechPage === totalPages ? 'disabled' : ''}>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
            const existingPagination = document.querySelector('.pagination-controls');
            if (existingPagination) existingPagination.remove();
            
            const cardElement = tbody.closest('.card');
            if (cardElement) {
                cardElement.insertAdjacentHTML('afterend', paginationHtml);
            }

            document.getElementById('prevTech')?.addEventListener('click', () => initTechStackPage(currentTechPage - 1));
            document.getElementById('nextTech')?.addEventListener('click', () => initTechStackPage(currentTechPage + 1));

            // Listeners
            tbody.querySelectorAll('.edit-tech').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(t => String(t.id) === String(id));
                    openTechStackModal('edit', item);
                });
            });

            tbody.querySelectorAll('.delete-tech').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleTechStackDelete(id);
                });
            });

        } catch (error) {
            console.error('Render tech stack error:', error);
            showToast('Failed to load tech stack', true);
        }
    };

    const openTechStackModal = (mode, item = null) => {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Edit Tech Item' : 'Add New Tech';

        const content = `
            <div class="form-group">
                <label>Technology Name</label>
                <input type="text" id="techName" value="${isEdit ? item.name : ''}" placeholder="e.g. React">
            </div>
            <div class="form-group">
                <label>Icon Class (FontAwesome)</label>
                <input type="text" id="techIcon" value="${isEdit ? item.icon_url : ''}" placeholder="fab fa-react">
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">Use FontAwesome classes like <b>fab fa-react</b> or <b>fas fa-database</b></p>
            </div>
            <div class="form-group">
                <label>Sort Order</label>
                <input type="number" id="techOrder" value="${isEdit ? item.sort_order : '0'}">
            </div>
        `;

        window.openModal(title, content, async () => {
            const name = document.getElementById('techName').value;
            const icon = document.getElementById('techIcon').value;
            const order = parseInt(document.getElementById('techOrder').value) || 0;

            if (!name || !icon) {
                showToast('Name and Icon are required', true);
                throw new Error('Missing fields');
            }

            try {
                const techData = {
                    name,
                    icon_url: icon,
                    sort_order: order
                };

                let res;
                if (isEdit) {
                    res = await window.supabase.from('tech_stack').update(techData).eq('id', item.id);
                } else {
                    res = await window.supabase.from('tech_stack').insert([techData]);
                }

                if (res.error) throw res.error;

                showToast(`Tech stack ${isEdit ? 'updated' : 'added'} successfully`);
                renderTechStack();

            } catch (error) {
                console.error('Tech stack save error:', error);
                showToast('Failed to save tech stack: ' + error.message, true);
                throw error;
            }
        });
    };

    const handleTechStackDelete = async (id) => {
        const title = 'Confirm Deletion';
        const content = `<p>Are you sure you want to delete this tech stack item?</p>`;

        window.openModal(title, content, async () => {
            try {
                const { error } = await window.supabase.from('tech_stack').delete().eq('id', id);
                if (error) throw error;

                showToast('Tech stack item deleted');
                renderTechStack();
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete tech stack item', true);
                throw error;
            }
        });

        const btn = document.getElementById('saveModal');
        if (btn) {
            btn.textContent = 'Delete';
            btn.classList.add('btn-danger');
        }
    };

    // --- Side Skills ---
    const initSideSkillsPage = async () => {
        const btnAdd = document.getElementById('addSideSkillBtn');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => openSideSkillModal('add'));
        }
        await renderSideSkills();
    };

    const renderSideSkills = async () => {
        const tbody = document.getElementById('sideSkillsList');
        if (!tbody) return;

        try {
            const { data, error } = await window.supabase
                .from('side_skills')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No side skills found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(skill => `
                <tr>
                    <td><i class="${skill.icon}" style="margin-right: 1rem; width: 20px;"></i> <strong>${skill.text}</strong></td>
                    <td><code>${skill.icon}</code></td>
                    <td>${skill.sort_order}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon edit-sideskill" data-id="${skill.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete delete-sideskill" data-id="${skill.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Listeners
            tbody.querySelectorAll('.edit-sideskill').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(s => String(s.id) === String(id));
                    openSideSkillModal('edit', item);
                });
            });

            tbody.querySelectorAll('.delete-sideskill').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleSideSkillDelete(id);
                });
            });

        } catch (error) {
            console.error('Render side skills error:', error);
            showToast('Failed to load side skills', true);
        }
    };

    const openSideSkillModal = (mode, item = null) => {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Edit Side Skill' : 'Add Side Skill';

        const content = `
            <div class="form-group">
                <label>Skill Name</label>
                <input type="text" id="skillName" value="${isEdit ? item.text : ''}" placeholder="e.g. Data Entry">
            </div>
            <div class="form-group">
                <label>Icon Class (FontAwesome)</label>
                <input type="text" id="skillIcon" value="${isEdit ? item.icon : ''}" placeholder="fas fa-table">
            </div>
            <div class="form-group">
                <label>Sort Order</label>
                <input type="number" id="skillOrder" value="${isEdit ? item.sort_order : '0'}">
            </div>
        `;

        window.openModal(title, content, async () => {
            const text = document.getElementById('skillName').value;
            const icon = document.getElementById('skillIcon').value;
            const order = parseInt(document.getElementById('skillOrder').value) || 0;

            if (!text || !icon) {
                showToast('Skill name and icon are required', true);
                throw new Error('Missing fields');
            }

            try {
                const skillData = {
                    text,
                    icon,
                    sort_order: order
                };

                let res;
                if (isEdit) {
                    res = await window.supabase.from('side_skills').update(skillData).eq('id', item.id);
                } else {
                    res = await window.supabase.from('side_skills').insert([skillData]);
                }

                if (res.error) throw res.error;

                showToast(`Side skill ${isEdit ? 'updated' : 'added'} successfully`);
                renderSideSkills();

            } catch (error) {
                console.error('Side skill save error:', error);
                showToast('Failed to save side skill: ' + error.message, true);
                throw error;
            }
        });
    };

    const handleSideSkillDelete = async (id) => {
        const title = 'Confirm Deletion';
        const content = `<p>Are you sure you want to delete this side skill?</p>`;

        window.openModal(title, content, async () => {
            try {
                const { error } = await window.supabase.from('side_skills').delete().eq('id', id);
                if (error) throw error;

                showToast('Side skill deleted');
                renderSideSkills();
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete side skill', true);
                throw error;
            }
        });

        const btn = document.getElementById('saveModal');
        if (btn) {
            btn.textContent = 'Delete';
            btn.classList.add('btn-danger');
        }
    };

    // --- Profile Details ---
    const initProfilePage = async () => {
        const form = document.getElementById('profileForm');
        if (!form) return;

        try {
            // Fetch current profile data
            const { data, error } = await window.supabase
                .from('profile')
                .select('*')
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error; 

            if (data) {
                document.getElementById('profFullName').value = data.full_name || '';
                document.getElementById('profRole').value = data.role || '';
                document.getElementById('profLocation').value = data.location || '';
                document.getElementById('profAboutPrimary').value = data.about_text || '';
                document.getElementById('profAboutSecondary').value = data.about_text_secondary || '';
                
                if (data.profile_image_url) {
                    const parts = data.profile_image_url.split('/');
                    document.getElementById('currentImageName').textContent = `Current: ${parts[parts.length - 1]}`;
                }

                // Show connect button if gmail is not enabled
                const connectBtn = document.getElementById('connectGmailBtn');
                if (connectBtn && !data.gmail_enabled) {
                    connectBtn.style.display = 'flex';
                } else if (connectBtn) {
                    connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> Gmail Connected (${data.gmail_email})`;
                    connectBtn.classList.remove('btn-primary');
                    connectBtn.classList.add('btn-success');
                    connectBtn.style.display = 'flex';
                    connectBtn.style.pointerEvents = 'none';
                }
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const saveBtn = form.querySelector('button[type="submit"]');
                const originalHtml = saveBtn.innerHTML;
                const fileInput = document.getElementById('profFile');
                const file = fileInput.files[0];

                try {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

                    let imageUrl = data?.profile_image_url || '';

                    if (file) {
                        // 1. Upload new profile image
                        const fileName = `images/profile/${Date.now()}-${file.name}`;
                        const { error: upErr } = await window.supabase.storage
                            .from('Gallery')
                            .upload(fileName, file);
                        
                        if (upErr) throw upErr;

                        const { data: urlData } = window.supabase.storage
                            .from('Gallery')
                            .getPublicUrl(fileName);
                        
                        // 2. Delete old image if it exists and is in Supabase storage
                        if (data?.profile_image_url && data.profile_image_url.includes('storage/v1/object/public/Gallery/')) {
                            const pathParts = data.profile_image_url.split('/Gallery/');
                            if (pathParts.length > 1) {
                                await window.supabase.storage.from('Gallery').remove([pathParts[1]]);
                            }
                        }

                        imageUrl = urlData.publicUrl;
                    }

                    const profileData = {
                        full_name: document.getElementById('profFullName').value,
                        role: document.getElementById('profRole').value,
                        location: document.getElementById('profLocation').value,
                        profile_image_url: imageUrl,
                        about_text: document.getElementById('profAboutPrimary').value,
                        about_text_secondary: document.getElementById('profAboutSecondary').value
                    };

                    let res;
                    if (data && data.id) {
                        res = await window.supabase.from('profile').update(profileData).eq('id', data.id);
                    } else {
                        res = await window.supabase.from('profile').insert([profileData]);
                    }

                    if (res.error) throw res.error;

                    showToast('Profile updated successfully');
                    if (file) {
                        const parts = imageUrl.split('/');
                        document.getElementById('currentImageName').textContent = `Current: ${parts[parts.length - 1]}`;
                        fileInput.value = ''; // clear input
                    }
                } catch (error) {
                    console.error('Profile save error:', error);
                    showToast('Failed to save profile: ' + error.message, true);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalHtml;
                }
            });

        } catch (error) {
            console.error('Init profile error:', error);
            showToast('Failed to load profile data', true);
        }
    };

    // --- Specialty Banner ---
    const initSpecialtyPage = async () => {
        const form = document.getElementById('specialtyForm');
        if (!form) return;

        try {
            const { data, error } = await window.supabase
                .from('specialty_banner')
                .select('*')
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                document.getElementById('specTitle').value = data.title || '';
                document.getElementById('specDesc').value = data.description || '';
                document.getElementById('specIconMain').value = data.icon_main || '';
                document.getElementById('specIconHeader').value = data.icon_header || '';
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const saveBtn = form.querySelector('button[type="submit"]');
                const originalHtml = saveBtn.innerHTML;

                try {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

                    const bannerData = {
                        title: document.getElementById('specTitle').value,
                        description: document.getElementById('specDesc').value,
                        icon_main: document.getElementById('specIconMain').value,
                        icon_header: document.getElementById('specIconHeader').value
                    };

                    let res;
                    if (data && data.id) {
                        res = await window.supabase.from('specialty_banner').update(bannerData).eq('id', data.id);
                    } else {
                        res = await window.supabase.from('specialty_banner').insert([bannerData]);
                    }

                    if (res.error) throw res.error;

                    showToast('Specialty banner updated successfully');
                } catch (error) {
                    console.error('Specialty banner save error:', error);
                    showToast('Failed to save banner: ' + error.message, true);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalHtml;
                }
            });

        } catch (error) {
            console.error('Init specialty error:', error);
            showToast('Failed to load specialty: ' + (error.message || 'Unknown error'), true);
        }
    };

    // --- Contact Messages ---
    const initMessagesPage = async () => {
        const btnRefresh = document.getElementById('refreshMessages');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                btnRefresh.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
                await renderMessages();
                btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            });
        }
        await renderMessages();
    };

    let currentMessagePage = 1;
    const messagePageSize = 10;

    const loadMessages = async (page = 1) => {
        currentMessagePage = page;
        const tbody = document.getElementById('messagesList');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading messages...</td></tr>';
        }
        await renderMessages();
    };

    const renderMessages = async () => {
        const tbody = document.getElementById('messagesList');
        if (!tbody) return;

        try {
            // 1. Fetch Web Messages
            const { data: webMessages, error } = await window.supabase
                .from('contact_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // 2. Fetch Gmail Messages (if enabled)
            let gmailMessages = [];
            const { data: profile } = await window.supabase.from('profile').select('gmail_enabled').single();
            if (profile?.gmail_enabled) {
                try {
                    const gRes = await fetch('https://portfolio-chat.makidevportfolio.workers.dev/gmail/list');
                    const data = await gRes.json();
                    if (Array.isArray(data)) {
                        gmailMessages = data;
                    }
                } catch (e) { console.error("Gmail fetch failed", e); }
            }

            // 3. Merge and Sort
            let allMessages = [
                ...webMessages.map(m => ({ ...m, source: 'Web Form' })),
                ...gmailMessages.map(m => ({
                    id: m.id,
                    name: m.from.split('<')[0].replace(/"/g, '').trim(),
                    email: m.from.match(/<(.+)>/)?.[1] || m.from,
                    subject: m.subject,
                    created_at: m.date,
                    message: m.snippet,
                    source: 'Gmail',
                    isGmail: true,
                    threadId: m.threadId
                }))
            ];

            // Sort by date descending
            allMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Pagination Logic
            const totalMessages = allMessages.length;
            const totalPages = Math.ceil(totalMessages / messagePageSize);
            const startIndex = (currentMessagePage - 1) * messagePageSize;
            const paginatedMessages = allMessages.slice(startIndex, startIndex + messagePageSize);

            if (paginatedMessages.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No messages found.</td></tr>';
                return;
            }

            tbody.innerHTML = paginatedMessages.map(msg => {
                const date = new Date(msg.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const badgeColor = msg.source === 'Gmail' ? '#ea4335' : '#0ea5e9';
                return `
                    <tr>
                        <td>
                            <span style="background: ${badgeColor}; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; color: white; margin-bottom: 4px; display: inline-block;">${msg.source}</span><br>
                            <strong>${msg.name}</strong>
                        </td>
                        <td>${msg.email}</td>
                        <td>${msg.subject}</td>
                        <td>${date}</td>
                        <td>
                            <div class="action-btns">
                                <button class="btn-icon view-msg" data-id="${msg.id}" data-source="${msg.source}" title="Read"><i class="fas fa-eye"></i></button>
                                ${!msg.isGmail ? `<button class="btn-icon delete delete-msg" data-id="${msg.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Add Pagination Controls
            let paginationHtml = `
                <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Showing ${startIndex + 1} to ${Math.min(startIndex + messagePageSize, totalMessages)} of ${totalMessages} messages
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-sm" id="prevPage" ${currentMessagePage === 1 ? 'disabled' : ''} style="padding: 0.4rem 0.8rem;">
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button class="btn btn-sm" id="nextPage" ${currentMessagePage === totalPages ? 'disabled' : ''} style="padding: 0.4rem 0.8rem;">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;

            const existingPagination = document.querySelector('.pagination-controls');
            if (existingPagination) existingPagination.remove();
            
            const cardElement = tbody.closest('.card');
            if (cardElement) {
                cardElement.insertAdjacentHTML('afterend', paginationHtml);
            }

            document.getElementById('prevPage')?.addEventListener('click', () => loadMessages(currentMessagePage - 1));
            document.getElementById('nextPage')?.addEventListener('click', () => loadMessages(currentMessagePage + 1));

            // Listeners
            tbody.querySelectorAll('.view-msg').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const source = btn.getAttribute('data-source');
                    const item = allMessages.find(m => String(m.id) === String(id) && m.source === source);
                    
                    const title = `Message from ${item.name}`;
                    const content = `
                        <div class="message-detail-view" style="padding: 1.5rem; background: var(--bg-primary); border-radius: 12px;">
                            <div class="msg-meta" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                    <h4 style="margin: 0; color: var(--blue-accent); font-size: 1.1rem;">${item.from || item.name}</h4>
                                    <span style="font-size: 0.8rem; color: var(--text-secondary); opacity: 0.7;">${item.date || new Date(item.created_at).toLocaleString()}</span>
                                </div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.3rem;">
                                    <span style="opacity: 0.6;">To:</span> ${item.email || 'You'}
                                </div>
                                <div style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 500;">
                                    <span style="opacity: 0.6;">Subject:</span> ${item.subject}
                                </div>
                            </div>
                            
                            <div class="msg-body" style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; line-height: 1.6; color: var(--text-primary); min-height: 100px; white-space: pre-wrap;">${item.snippet || item.message}</div>
                            
                            <div class="reply-section" style="background: rgba(0, 123, 255, 0.05); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(0, 123, 255, 0.1);">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: var(--blue-accent);">
                                    <i class="fas fa-reply"></i>
                                    <span style="font-weight: 600; font-size: 0.9rem;">Reply to ${item.name || (item.from ? item.from.split('<')[0] : 'Sender')}</span>
                                </div>
                                <textarea id="replyBody" placeholder="Write your response here..." 
                                    style="width: 100%; min-height: 150px; background: var(--bg-secondary); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; color: var(--text-primary); font-family: inherit; font-size: 0.95rem; resize: vertical; margin-bottom: 1rem; outline: none; transition: border-color 0.3s;"
                                    onfocus="this.style.borderColor='var(--blue-accent)'"
                                    onblur="this.style.borderColor='rgba(255,255,255,0.1)'"></textarea>
                                <div style="display: flex; justify-content: flex-end;">
                                    <button class="btn btn-primary" id="btnSendReply" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem;">
                                        <i class="fas fa-paper-plane"></i> Send Reply
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    window.openModal(title, content, null);
                    
                    // Hide default modal save
                    const saveBtn = document.getElementById('saveModal');
                    if (saveBtn) saveBtn.style.display = 'none';

                    // Reply Logic
                    document.getElementById('btnSendReply').addEventListener('click', async () => {
                        const replyBody = document.getElementById('replyBody').value;
                        if (!replyBody) return showToast('Reply cannot be empty', true);

                        const sendBtn = document.getElementById('btnSendReply');
                        const originalHtml = sendBtn.innerHTML;

                        try {
                            sendBtn.disabled = true;
                            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

                            const res = await fetch('https://portfolio-chat.makidevportfolio.workers.dev/gmail/reply', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    to: item.email,
                                    subject: item.subject,
                                    message: replyBody,
                                    threadId: item.isGmail ? item.threadId : null
                                })
                            });

                            if (!res.ok) throw new Error("Failed to send email");

                            showToast('Reply sent successfully!');
                            document.getElementById('adminModal').style.display = 'none';
                        } catch (e) {
                            console.error(e);
                            showToast('Error sending reply', true);
                        } finally {
                            sendBtn.disabled = false;
                            sendBtn.innerHTML = originalHtml;
                        }
                    });
                });
            });

            tbody.querySelectorAll('.delete-msg').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleMessageDelete(id);
                });
            });

        } catch (error) {
            console.error('Render messages error:', error);
            showToast('Failed to load messages', true);
        }
    };

    const handleMessageDelete = async (id) => {
        const title = 'Confirm Deletion';
        const content = `<p>Are you sure you want to delete this message?</p>`;

        window.openModal(title, content, async () => {
            try {
                const { error } = await window.supabase.from('contact_messages').delete().eq('id', id);
                if (error) throw error;

                showToast('Message deleted');
                renderMessages();
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete message', true);
                throw error;
            }
        });

        const btn = document.getElementById('saveModal');
        if (btn) {
            btn.textContent = 'Delete';
            btn.classList.add('btn-danger');
        }
    };

    // --- Social Links ---
    const initSocialLinksPage = async () => {
        const btnAdd = document.getElementById('addSocialBtn');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => openSocialLinkModal('add'));
        }
        await renderSocialLinks();
    };

    const renderSocialLinks = async () => {
        const tbody = document.getElementById('socialLinksList');
        if (!tbody) return;

        try {
            const { data, error } = await window.supabase
                .from('social_links')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No social links found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(link => `
                <tr>
                    <td><i class="${link.icon}" style="margin-right: 1rem; width: 20px;"></i> <strong>${link.name}</strong></td>
                    <td><a href="${link.url}" target="_blank" style="color: var(--blue-primary);">${link.url}</a></td>
                    <td>${link.sort_order}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon edit-social" data-id="${link.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete delete-social" data-id="${link.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Listeners
            tbody.querySelectorAll('.edit-social').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(s => String(s.id) === String(id));
                    openSocialLinkModal('edit', item);
                });
            });

            tbody.querySelectorAll('.delete-social').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleSocialLinkDelete(id);
                });
            });

        } catch (error) {
            console.error('Render social links error:', error);
            showToast('Failed to load social links', true);
        }
    };

    const openSocialLinkModal = (mode, item = null) => {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Edit Social Link' : 'Add Social Link';

        const content = `
            <div class="form-group">
                <label>Platform Name</label>
                <input type="text" id="socialName" value="${isEdit ? item.name : ''}" placeholder="e.g. GitHub">
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="url" id="socialUrl" value="${isEdit ? item.url : ''}" placeholder="https://github.com/...">
            </div>
            <div class="form-group">
                <label>Icon Class (FontAwesome)</label>
                <input type="text" id="socialIcon" value="${isEdit ? item.icon : ''}" placeholder="fab fa-github">
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">e.g. <b>fab fa-linkedin</b>, <b>fab fa-facebook</b></p>
            </div>
            <div class="form-group">
                <label>Sort Order</label>
                <input type="number" id="socialOrder" value="${isEdit ? item.sort_order : '0'}">
            </div>
        `;

        window.openModal(title, content, async () => {
            const name = document.getElementById('socialName').value;
            const url = document.getElementById('socialUrl').value;
            const icon = document.getElementById('socialIcon').value;
            const order = parseInt(document.getElementById('socialOrder').value) || 0;

            if (!name || !url || !icon) {
                showToast('All fields are required', true);
                throw new Error('Missing fields');
            }

            try {
                const socialData = {
                    name,
                    url,
                    icon,
                    sort_order: order
                };

                let res;
                if (isEdit) {
                    res = await window.supabase.from('social_links').update(socialData).eq('id', item.id);
                } else {
                    res = await window.supabase.from('social_links').insert([socialData]);
                }

                if (res.error) throw res.error;

                showToast(`Social link ${isEdit ? 'updated' : 'added'} successfully`);
                renderSocialLinks();

            } catch (error) {
                console.error('Social link save error:', error);
                showToast('Failed to save social link: ' + error.message, true);
                throw error;
            }
        });
    };

    const handleSocialLinkDelete = async (id) => {
        const title = 'Confirm Deletion';
        const content = `<p>Are you sure you want to delete this social link?</p>`;

        window.openModal(title, content, async () => {
            try {
                const { error } = await window.supabase.from('social_links').delete().eq('id', id);
                if (error) throw error;

                showToast('Social link deleted');
                renderSocialLinks();
            } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete social link', true);
                throw error;
            }
        });

        const btn = document.getElementById('saveModal');
        if (btn) {
            btn.textContent = 'Delete';
            btn.classList.add('btn-danger');
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

    // --- Quick Facts Management ---
    const initQuickFactsPage = async () => {
        const btnAdd = document.getElementById('addFactBtn');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => openQuickFactModal('add'));
        }
        await renderQuickFacts();
    };

    const renderQuickFacts = async () => {
        const tbody = document.getElementById('quickFactsList');
        if (!tbody) return;

        try {
            const { data, error } = await window.supabase
                .from('quick_facts')
                .select('*')
                .order('sort_order');

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No facts found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(item => `
                <tr>
                    <td><i class="${item.icon}" style="color: var(--blue-primary); width: 20px;"></i> ${item.text}</td>
                    <td><code>${item.icon}</code></td>
                    <td>${item.sort_order}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn-icon edit-fact" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete delete-fact" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');

            // Listeners
            tbody.querySelectorAll('.edit-fact').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(f => String(f.id) === String(id));
                    openQuickFactModal('edit', item);
                });
            });

            tbody.querySelectorAll('.delete-fact').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    handleQuickFactDelete(id);
                });
            });

        } catch (error) {
            console.error('Render quick facts error:', error);
            showToast('Failed to load quick facts', true);
        }
    };

    const openQuickFactModal = (mode, item = null) => {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Edit Quick Fact' : 'Add Quick Fact';

        const content = `
            <div class="form-group">
                <label>Fact Text</label>
                <input type="text" id="factText" value="${isEdit ? item.text : ''}" placeholder="e.g. Based in Davao del Sur">
            </div>
            <div class="form-group">
                <label>Icon Class (FontAwesome)</label>
                <input type="text" id="factIcon" value="${isEdit ? item.icon : ''}" placeholder="fas fa-location-dot">
            </div>
            <div class="form-group">
                <label>Sort Order</label>
                <input type="number" id="factOrder" value="${isEdit ? item.sort_order : '0'}">
            </div>
        `;

        window.openModal(title, content, async () => {
            const text = document.getElementById('factText').value;
            const icon = document.getElementById('factIcon').value;
            const order = parseInt(document.getElementById('factOrder').value) || 0;

            if (!text || !icon) {
                showToast('Please fill in all fields', true);
                throw new Error('Missing fields');
            }

            try {
                let result;
                if (isEdit) {
                    result = await window.supabase
                        .from('quick_facts')
                        .update({ text, icon, sort_order: order })
                        .eq('id', item.id);
                } else {
                    result = await window.supabase
                        .from('quick_facts')
                        .insert([{ text, icon, sort_order: order }]);
                }

                if (result.error) throw result.error;

                showToast(isEdit ? 'Fact updated!' : 'Fact added successfully!');
                renderQuickFacts();
            } catch (error) {
                console.error('Save fact error:', error);
                showToast('Save failed: ' + error.message, true);
                throw error;
            }
        });
    };

    const handleQuickFactDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this fact?')) return;

        try {
            const { error } = await window.supabase
                .from('quick_facts')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Fact deleted successfully');
            renderQuickFacts();
        } catch (error) {
            console.error('Delete fact error:', error);
            showToast('Delete failed: ' + error.message, true);
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

    // Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                const { error } = await window.supabase.auth.signOut();
                if (error) {
                    console.error('Logout error:', error);
                    showToast('Logout failed', true);
                } else {
                    window.location.href = 'login.html';
                }
            }
        });
    }
});
