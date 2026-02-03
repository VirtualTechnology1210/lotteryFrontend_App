import apiClient from './index';

export const permissionService = {
    // Get all permissions
    getAllPermissions: async () => {
        return apiClient.get('/permissions');
    },

    // Get permissions by role
    getPermissionsByRole: async (roleId) => {
        return apiClient.get(`/permissions/role/${roleId}`);
    },

    // Get my permissions (current user)
    getMyPermissions: async () => {
        return apiClient.get('/permissions/my');
    },

    // Create or update permission
    addOrUpdatePermission: async (data) => {
        return apiClient.post('/permissions', data);
    },

    // Bulk update permissions
    bulkUpdatePermissions: async (data) => {
        return apiClient.post('/permissions/bulk', data);
    },

    // Delete permission
    deletePermission: async (id) => {
        return apiClient.delete(`/permissions/${id}`);
    }
};

export const pageService = {
    // Get all pages
    getAllPages: async () => {
        return apiClient.get('/pages');
    },

    // Get page by ID
    getPageById: async (id) => {
        return apiClient.get(`/pages/${id}`);
    },

    // Create page
    createPage: async (data) => {
        return apiClient.post('/pages', data);
    },

    // Update page
    updatePage: async (id, data) => {
        return apiClient.put(`/pages/${id}`, data);
    },

    // Delete page
    deletePage: async (id) => {
        return apiClient.delete(`/pages/${id}`);
    }
};

export const roleService = {
    // Get all roles
    getAllRoles: async () => {
        return apiClient.get('/roles');
    }
};
