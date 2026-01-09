'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'BUTTONS';
  text?: string;
  format?: 'TEXT' | 'IMAGE';
  image_data?: string; // Base64 encoded image data
  image_url?: string; // URL if image is stored externally
  images?: string[]; // Array of image URLs for BODY component (up to 8)
  example?: {
    header_handle?: string[];
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface WhatsAppTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
  variable_count: number;
  is_custom: boolean;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  image5?: string;
  image6?: string;
  image7?: string;
  image8?: string;
  button1_text?: string;
  button1_type?: 'URL' | 'PHONE_NUMBER';
  button1_url?: string;
  button1_phone?: string;
  button2_text?: string;
  button2_type?: 'URL' | 'PHONE_NUMBER';
  button2_url?: string;
  button2_phone?: string;
}

export default function WhatsAppTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  
  const [formData, setFormData] = useState<WhatsAppTemplate>({
    name: '',
    language: 'en',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [],
    variable_count: 0,
    is_custom: true,
  });

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/whatsapp/templates?is_custom=true');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  function handleAddComponent(type: 'HEADER' | 'BODY' | 'BUTTONS') {
    // Check if component type already exists
    const componentExists = formData.components.some(comp => comp.type === type);
    if (componentExists) {
      setError(`${type} component already exists. You can only add one ${type} component.`);
      return;
    }

    const newComponent: TemplateComponent = {
      type,
      text: '',
      format: (type === 'HEADER' || type === 'BODY') ? 'TEXT' : undefined,
    };
    
    if (type === 'BUTTONS') {
      newComponent.buttons = [];
    }

    if (type === 'BODY') {
      newComponent.images = [];
    }

    // Add component and sort to maintain order: BUTTONS, HEADER, BODY
    const updatedComponents = [...formData.components, newComponent];
    const order = { BUTTONS: 0, HEADER: 1, BODY: 2 };
    updatedComponents.sort((a, b) => {
      return (order[a.type as keyof typeof order] || 999) - (order[b.type as keyof typeof order] || 999);
    });

    setFormData({
      ...formData,
      components: updatedComponents,
    });
    setError(null);
  }

  function handleUpdateComponent(index: number, updates: Partial<TemplateComponent>) {
    const updated = [...formData.components];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, components: updated });
    updateVariableCount(updated);
  }

  function handleRemoveComponent(index: number) {
    const updated = formData.components.filter((_, i) => i !== index);
    setFormData({ ...formData, components: updated });
    updateVariableCount(updated);
  }

  function updateVariableCount(components: TemplateComponent[]) {
    let maxVar = 0;
    components.forEach(comp => {
      if (comp.text) {
        const matches = comp.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach(match => {
            const num = parseInt(match.replace(/\{\{|\}\}/g, ''));
            if (num > maxVar) maxVar = num;
          });
        }
      }
    });
    setFormData(prev => ({ ...prev, variable_count: maxVar }));
  }

  function handleAddButton(componentIndex: number) {
    const updated = [...formData.components];
    if (!updated[componentIndex].buttons) {
      updated[componentIndex].buttons = [];
    }
    // Limit to 2 buttons
    if (updated[componentIndex].buttons!.length >= 2) {
      setError('Maximum 2 buttons allowed');
      return;
    }
    updated[componentIndex].buttons!.push({
      type: 'URL',
      text: '',
    });
    setFormData({ ...formData, components: updated });
  }

  function handleUpdateButton(componentIndex: number, buttonIndex: number, updates: Partial<NonNullable<TemplateComponent['buttons']>[number]>) {
    const updated = [...formData.components];
    if (updated[componentIndex].buttons) {
      updated[componentIndex].buttons![buttonIndex] = {
        ...updated[componentIndex].buttons![buttonIndex],
        ...updates,
      };
      setFormData({ ...formData, components: updated });
    }
  }

  function handleRemoveButton(componentIndex: number, buttonIndex: number) {
    const updated = [...formData.components];
    if (updated[componentIndex].buttons) {
      updated[componentIndex].buttons = updated[componentIndex].buttons!.filter((_, i) => i !== buttonIndex);
      setFormData({ ...formData, components: updated });
    }
  }

  function handleImageUpload(componentIndex: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      const updated = [...formData.components];
      updated[componentIndex] = {
        ...updated[componentIndex],
        image_data: base64String,
        image_url: undefined, // Clear URL if base64 is set
      };
      setFormData({ ...formData, components: updated });
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  }

  async function handleBodyImageUpload(componentIndex: number, imageIndex: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      // Convert file to FormData
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      // Upload to Supabase Storage
      const uploadResponse = await fetch('/api/whatsapp/templates/upload-image', {
        method: 'POST',
        body: uploadFormData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        // Update the component's images array
        const updated = [...formData.components];
        const currentImages = updated[componentIndex].images || [];
        // Add image to the array (find first empty slot or append)
        const newImages = [...currentImages];
        // Find the first empty slot or add to the end
        const emptyIndex = newImages.findIndex(img => !img);
        if (emptyIndex >= 0) {
          newImages[emptyIndex] = uploadData.url;
        } else if (newImages.length < 8) {
          newImages.push(uploadData.url);
        } else {
          setError('Maximum 8 images allowed');
          return;
        }
        updated[componentIndex] = {
          ...updated[componentIndex],
          images: newImages.filter(img => img !== undefined),
        };
        setFormData({ ...formData, components: updated });
        setError(null);
      } else {
        const errorData = await uploadResponse.json();
        setError(errorData.error || 'Failed to upload image');
      }
    } catch (err) {
      setError('Failed to upload image');
      console.error('Image upload error:', err);
    }
  }

  function handleRemoveBodyImage(componentIndex: number, imageIndex: number) {
    const updated = [...formData.components];
    const currentImages = updated[componentIndex].images || [];
    const newImages = currentImages.filter((_, idx) => idx !== imageIndex);
    updated[componentIndex] = {
      ...updated[componentIndex],
      images: newImages,
    };
    setFormData({ ...formData, components: updated });
  }

  function handleRemoveImage(componentIndex: number) {
    const updated = [...formData.components];
    updated[componentIndex] = {
      ...updated[componentIndex],
      image_data: undefined,
      image_url: undefined,
    };
    setFormData({ ...formData, components: updated });
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    if (formData.components.length === 0) {
      setError('At least one component is required');
      return;
    }

    // Validate components
    for (const comp of formData.components) {
      if (comp.type === 'HEADER' && !comp.text) {
        setError('Header must have text');
        return;
      }
      if (comp.type === 'BODY' && comp.format === 'TEXT' && !comp.text) {
        setError('Body text is required when format is TEXT');
        return;
      }
      if (comp.type === 'BODY' && comp.format === 'IMAGE' && (!comp.images || comp.images.length === 0)) {
        setError('At least one body image is required when format is IMAGE');
        return;
      }
      if (comp.type === 'BUTTONS' && (!comp.buttons || comp.buttons.length === 0)) {
        setError('Buttons component must have at least one button');
        return;
      }
      if (comp.type === 'BUTTONS' && comp.buttons && comp.buttons.length > 2) {
        setError('Maximum 2 buttons allowed');
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload images to Supabase Storage first
      const componentsToSave = await Promise.all(
        formData.components.map(async (comp) => {
          // If component has base64 image_data, upload it to storage
          if (comp.image_data && !comp.image_url) {
            try {
              // Convert base64 data URL to blob
              const base64Data = comp.image_data.split(',')[1]; // Remove data:image/...;base64, prefix
              const mimeType = comp.image_data.split(',')[0].split(':')[1].split(';')[0]; // Extract mime type
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });
              
              // Create form data for upload
              const uploadFormData = new FormData();
              const fileExt = mimeType.split('/')[1] || 'jpg';
              const fileName = `template-image-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
              uploadFormData.append('image', blob, fileName);

              // Upload to Supabase Storage
              const uploadResponse = await fetch('/api/whatsapp/templates/upload-image', {
                method: 'POST',
                body: uploadFormData,
              });

              if (uploadResponse.ok) {
                const uploadData = await uploadResponse.json();
                // Replace image_data with image_url
                return {
                  ...comp,
                  image_data: undefined, // Remove base64 data
                  image_url: uploadData.url, // Store URL instead
                };
              } else {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Failed to upload image');
              }
            } catch (uploadError) {
              console.error('Image upload error:', uploadError);
              throw new Error(uploadError instanceof Error ? uploadError.message : 'Failed to upload image');
            }
          }
          // If image_url already exists, keep it and remove image_data
          if (comp.image_url && comp.image_data) {
            return {
              ...comp,
              image_data: undefined,
            };
          }
          return comp;
        })
      );

      // Extract images from BODY components and store in image1-image8
      const bodyImages: string[] = [];
      for (const comp of componentsToSave) {
        if (comp.type === 'BODY' && comp.images && comp.images.length > 0) {
          bodyImages.push(...comp.images);
        }
      }
      // Limit to 8 images
      const imagesToSave = bodyImages.slice(0, 8);

      // Extract buttons from BUTTONS component and store in button1-button2 columns
      let button1: any = null;
      let button2: any = null;
      for (const comp of componentsToSave) {
        if (comp.type === 'BUTTONS' && comp.buttons && comp.buttons.length > 0) {
          button1 = comp.buttons[0] || null;
          button2 = comp.buttons[1] || null;
          break;
        }
      }

      // Prepare data with uploaded image URLs
      const dataToSave: any = {
        ...formData,
        components: componentsToSave,
        // Store BODY images in image1-image8 columns
        image1: imagesToSave[0] || null,
        image2: imagesToSave[1] || null,
        image3: imagesToSave[2] || null,
        image4: imagesToSave[3] || null,
        image5: imagesToSave[4] || null,
        image6: imagesToSave[5] || null,
        image7: imagesToSave[6] || null,
        image8: imagesToSave[7] || null,
        // Store buttons in button1-button2 columns
        button1_text: button1?.text || null,
        button1_type: button1?.type || null,
        button1_url: button1?.type === 'URL' ? button1?.url || null : null,
        button1_phone: button1?.type === 'PHONE_NUMBER' ? button1?.phone_number || null : null,
        button2_text: button2?.text || null,
        button2_type: button2?.type || null,
        button2_url: button2?.type === 'URL' ? button2?.url || null : null,
        button2_phone: button2?.type === 'PHONE_NUMBER' ? button2?.phone_number || null : null,
      };

      const url = editingTemplate 
        ? `/api/whatsapp/templates/${editingTemplate.id}`
        : '/api/whatsapp/templates';
      
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      setSuccess(editingTemplate ? 'Template updated successfully!' : 'Template created successfully!');
      setShowForm(false);
      setEditingTemplate(null);
      setFormData({
        name: '',
        language: 'en',
        category: 'MARKETING',
        status: 'APPROVED',
        components: [],
        variable_count: 0,
        is_custom: true,
      });
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(template: WhatsAppTemplate) {
    setEditingTemplate(template);
    // Restore images from image1-image8 to BODY component's images array
    // Restore buttons from button1-button2 columns to BUTTONS component
    const restoredTemplate = { ...template };
    if (restoredTemplate.components) {
      // First restore data
      let restoredComponents = restoredTemplate.components.map(comp => {
        if (comp.type === 'BODY' && comp.format === 'IMAGE') {
          // Collect images from image1-image8
          const images: string[] = [];
          for (let i = 1; i <= 8; i++) {
            const imageField = `image${i}` as keyof WhatsAppTemplate;
            const imageUrl = template[imageField] as string | undefined;
            if (imageUrl) {
              images.push(imageUrl);
            }
          }
          return { ...comp, images };
        }
        if (comp.type === 'BUTTONS') {
          // Restore buttons from button1-button2 columns
          const buttons: Array<{ type: 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string }> = [];
          if (template.button1_text && template.button1_type) {
            buttons.push({
              type: template.button1_type,
              text: template.button1_text,
              url: template.button1_url,
              phone_number: template.button1_phone,
            });
          }
          if (template.button2_text && template.button2_type) {
            buttons.push({
              type: template.button2_type,
              text: template.button2_text,
              url: template.button2_url,
              phone_number: template.button2_phone,
            });
          }
          return { ...comp, buttons };
        }
        return comp;
      });
      
      // Sort components: BUTTONS first, then HEADER, then BODY
      const order = { BUTTONS: 0, HEADER: 1, BODY: 2 };
      restoredComponents.sort((a, b) => {
        return (order[a.type as keyof typeof order] || 999) - (order[b.type as keyof typeof order] || 999);
      });
      
      restoredTemplate.components = restoredComponents;
    }
    setFormData(restoredTemplate);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/whatsapp/templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      setSuccess('Template deleted successfully!');
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      language: 'en',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [],
      variable_count: 0,
      is_custom: true,
      image1: undefined,
      image2: undefined,
      image3: undefined,
      image4: undefined,
      image5: undefined,
      image6: undefined,
      image7: undefined,
      image8: undefined,
    });
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Templates</h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Template
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {showForm ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., welcome_message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="en">English</option>
                    <option value="zh_HK">Chinese (Hong Kong)</option>
                    <option value="zh_CN">Chinese (Simplified)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Components *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddComponent('BUTTONS')}
                      disabled={formData.components.some(c => c.type === 'BUTTONS')}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Buttons
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddComponent('BODY')}
                      disabled={formData.components.some(c => c.type === 'BODY')}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Body
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddComponent('HEADER')}
                      disabled={formData.components.some(c => c.type === 'HEADER')}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Header
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    // Sort components: BUTTONS first, then HEADER, then BODY
                    const sortedComponents = [...formData.components].sort((a, b) => {
                      const order = { BUTTONS: 0, HEADER: 1, BODY: 2 };
                      return (order[a.type as keyof typeof order] || 999) - (order[b.type as keyof typeof order] || 999);
                    });
                    
                    return sortedComponents.map((component) => {
                      // Find the original index for proper updates
                      const originalIndex = formData.components.indexOf(component);
                      return { component, originalIndex };
                    }).map(({ component, originalIndex }, displayIndex) => (
                    <div key={`${component.type}-${originalIndex}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{component.type}</h3>
                        <button
                          type="button"
                          onClick={() => handleRemoveComponent(originalIndex)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      {component.type === 'HEADER' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Header Text *
                          </label>
                          <input
                            type="text"
                            value={component.text || ''}
                            onChange={(e) => {
                              const updated = [...formData.components];
                              updated[originalIndex] = { ...updated[originalIndex], text: e.target.value };
                              setFormData({ ...formData, components: updated });
                              updateVariableCount(updated);
                            }}
                            placeholder="(input here)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                          />
                        </div>
                      )}

                      {component.type === 'BODY' && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Format
                            </label>
                            <select
                              value={component.format || 'TEXT'}
                              onChange={(e) => handleUpdateComponent(originalIndex, { format: e.target.value as any })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                            >
                              <option value="TEXT">Text</option>
                              <option value="IMAGE">Image</option>
                            </select>
                          </div>
                          {component.format === 'TEXT' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Body Text
                              </label>
                              <textarea
                                value={component.text || ''}
                                onChange={(e) => {
                                  const updated = [...formData.components];
                                  updated[originalIndex] = { ...updated[originalIndex], text: e.target.value };
                                  setFormData({ ...formData, components: updated });
                                  updateVariableCount(updated);
                                }}
                                placeholder="Message body"
                                rows={4}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Use {'{{1}}'}, {'{{2}}'}, {'{{3}}'} for variables
                              </p>
                            </div>
                          )}
                          {component.format === 'IMAGE' && (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Upload Images (Maximum 8 images)
                              </label>
                              {/* WhatsApp-like background */}
                              <div className="bg-[#e5ddd5] p-4 rounded-lg border border-gray-300" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                {/* Images grid - 3 per row */}
                                {(component.images || []).length > 0 && (
                                  <div className="grid grid-cols-3 gap-3 mb-3">
                                    {(component.images || []).map((imageUrl, imageIndex) => (
                                      <div key={imageIndex} className="relative aspect-square overflow-hidden rounded">
                                        <div className="relative w-full h-full flex items-center justify-center">
                                          <img
                                            src={imageUrl}
                                            alt={`Body image ${imageIndex + 1}`}
                                            className="object-contain rounded"
                                            style={{ 
                                              maxWidth: '100%', 
                                              maxHeight: '100%',
                                              width: 'auto',
                                              height: 'auto'
                                            }}
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveBodyImage(originalIndex, imageIndex)}
                                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700 shadow-md z-10"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Show file input only if less than 8 images */}
                                {(component.images || []).length < 8 && (
                                  <div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const images = component.images || [];
                                        handleBodyImageUpload(originalIndex, images.length, e);
                                      }}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                                    />
                                  </div>
                                )}
                              </div>
                              
                              {/* Show helper text when no images */}
                              {(!component.images || component.images.length === 0) && (
                                <p className="text-xs text-gray-500">
                                  Upload an image for the body (max 8 images, 5MB each). After uploading, you can add more.
                                </p>
                              )}
                              
                              <label className="block text-xs font-medium text-gray-700 mb-1 mt-2">
                                Body Text (Optional - appears below images)
                              </label>
                              <textarea
                                value={component.text || ''}
                                onChange={(e) => {
                                  const updated = [...formData.components];
                                  updated[originalIndex] = { ...updated[originalIndex], text: e.target.value };
                                  setFormData({ ...formData, components: updated });
                                  updateVariableCount(updated);
                                }}
                                placeholder="Optional text below images"
                                rows={3}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {component.type === 'BUTTONS' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-medium text-gray-700">
                              Buttons (Maximum 2)
                            </label>
                            {(component.buttons?.length || 0) < 2 && (
                              <button
                                type="button"
                                onClick={() => handleAddButton(originalIndex)}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                + Add Button
                              </button>
                            )}
                          </div>
                          {component.buttons?.map((button, btnIndex) => (
                            <div key={btnIndex} className="border border-gray-200 rounded p-2">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-medium text-gray-700">Button {btnIndex + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveButton(originalIndex, btnIndex)}
                                  className="text-xs text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Type
                                  </label>
                                  <select
                                    value={button.type}
                                    onChange={(e) => handleUpdateButton(originalIndex, btnIndex, { type: e.target.value as any })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                  >
                                    <option value="URL">URL</option>
                                    <option value="PHONE_NUMBER">Phone Number</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Button Text *
                                  </label>
                                  <input
                                    type="text"
                                    value={button.text}
                                    onChange={(e) => handleUpdateButton(originalIndex, btnIndex, { text: e.target.value })}
                                    placeholder="Button text"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                  />
                                </div>
                                {button.type === 'URL' && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      URL *
                                    </label>
                                    <input
                                      type="url"
                                      value={button.url || ''}
                                      onChange={(e) => handleUpdateButton(originalIndex, btnIndex, { url: e.target.value })}
                                      placeholder="https://example.com"
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                    />
                                  </div>
                                )}
                                {button.type === 'PHONE_NUMBER' && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Phone Number *
                                    </label>
                                    <input
                                      type="tel"
                                      value={button.phone_number || ''}
                                      onChange={(e) => handleUpdateButton(originalIndex, btnIndex, { phone_number: e.target.value })}
                                      placeholder="+1234567890"
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Custom Templates</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No custom templates found. Create one to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variables</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{template.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.language}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.category || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.variable_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(template)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => template.id && handleDelete(template.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

