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

    // --- Projects Management ---
    const initProjectsPage = async () => {
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

            tbody.innerHTML = data.map(project => {
                let displayUrl = project.image_url || '';
                
                // Path normalization
                if (displayUrl.startsWith('http') || displayUrl.startsWith('blob:') || displayUrl.startsWith('data:')) {
                    // OK
                } else {
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

            // Listeners
            tbody.querySelectorAll('.edit-project').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(p => String(p.id) === String(id));
                    if (item) {
                        openProjectModal('edit', item);
                    } else {
                        showToast('Project not found', true);
                    }
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
    const initTechStackPage = async () => {
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

            tbody.innerHTML = data.map(tech => `
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
                document.getElementById('specBtnText').value = data.button_text || '';
                document.getElementById('specBtnLink').value = data.button_link || '';
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
                        icon_header: document.getElementById('specIconHeader').value,
                        button_text: document.getElementById('specBtnText').value,
                        button_link: document.getElementById('specBtnLink').value
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
            showToast('Failed to load specialty banner data', true);
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

    const renderMessages = async () => {
        const tbody = document.getElementById('messagesList');
        if (!tbody) return;

        try {
            const { data, error } = await window.supabase
                .from('contact_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No messages found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(msg => {
                const date = new Date(msg.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                return `
                    <tr>
                        <td><strong>${msg.name}</strong></td>
                        <td>${msg.email}</td>
                        <td>${msg.subject}</td>
                        <td>${date}</td>
                        <td>
                            <div class="action-btns">
                                <button class="btn-icon view-msg" data-id="${msg.id}" title="Read"><i class="fas fa-eye"></i></button>
                                <button class="btn-icon delete delete-msg" data-id="${msg.id}" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Listeners
            tbody.querySelectorAll('.view-msg').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const item = data.find(m => String(m.id) === String(id));
                    
                    const title = `Message from ${item.name}`;
                    const content = `
                        <div style="color: var(--text-secondary); margin-bottom: 1rem;">
                            <p><strong>From:</strong> ${item.name} (${item.email})</p>
                            <p><strong>Subject:</strong> ${item.subject}</p>
                            <p><strong>Date:</strong> ${new Date(item.created_at).toLocaleString()}</p>
                        </div>
                        <hr style="border: 0; border-top: 1px solid var(--border); margin: 1rem 0;">
                        <div style="white-space: pre-wrap; line-height: 1.6;">${item.message}</div>
                    `;
                    window.openModal(title, content, null); // null means no save button needed
                    
                    // Hide save button in the modal since this is just viewing
                    const saveBtn = document.getElementById('saveModal');
                    if (saveBtn) saveBtn.style.display = 'none';
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
