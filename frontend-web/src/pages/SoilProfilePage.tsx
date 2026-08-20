import React, { useState, useEffect } from 'react';
import { soilApi } from '../api/client';

interface SoilProfileForm {
  plotName: string;
  latitude: string;
  longitude: string;
  soilType: string;
  ph: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
}

interface FieldErrors {
  plotName?: string;
  latitude?: string;
  longitude?: string;
  soilType?: string;
  ph?: string;
  nitrogen?: string;
  phosphorus?: string;
  potassium?: string;
}

interface SoilProfilePageProps {
  profileId?: string;
  onNavigate?: (page: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 16,
  boxSizing: 'border-box',
};

const fieldStyle: React.CSSProperties = { marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6 };
const errorStyle: React.CSSProperties = { color: 'red', fontSize: 13, marginTop: 4 };

function validate(form: SoilProfileForm): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.plotName.trim()) {
    errors.plotName = 'Plot name is required.';
  }

  const lat = parseFloat(form.latitude);
  if (form.latitude === '' || isNaN(lat) || lat < -90 || lat > 90) {
    errors.latitude = 'Latitude must be a number between -90 and 90.';
  }

  const lon = parseFloat(form.longitude);
  if (form.longitude === '' || isNaN(lon) || lon < -180 || lon > 180) {
    errors.longitude = 'Longitude must be a number between -180 and 180.';
  }

  if (!form.soilType.trim()) {
    errors.soilType = 'Soil type is required.';
  }

  const ph = parseFloat(form.ph);
  if (form.ph === '' || isNaN(ph) || ph < 0 || ph > 14) {
    errors.ph = 'pH must be between 0 and 14.';
  }

  const nitrogen = parseFloat(form.nitrogen);
  if (form.nitrogen === '' || isNaN(nitrogen) || nitrogen < 0) {
    errors.nitrogen = 'Nitrogen must be a non-negative number.';
  }

  const phosphorus = parseFloat(form.phosphorus);
  if (form.phosphorus === '' || isNaN(phosphorus) || phosphorus < 0) {
    errors.phosphorus = 'Phosphorus must be a non-negative number.';
  }

  const potassium = parseFloat(form.potassium);
  if (form.potassium === '' || isNaN(potassium) || potassium < 0) {
    errors.potassium = 'Potassium must be a non-negative number.';
  }

  return errors;
}

const EMPTY_FORM: SoilProfileForm = {
  plotName: '',
  latitude: '',
  longitude: '',
  soilType: '',
  ph: '',
  nitrogen: '',
  phosphorus: '',
  potassium: '',
};

const SoilProfilePage: React.FC<SoilProfilePageProps> = ({ profileId, onNavigate }) => {
  const [form, setForm] = useState<SoilProfileForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');

  const isEdit = Boolean(profileId);

  const detectLocation = (isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    if (!isAuto) setError('');
    setLocationLabel('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setForm(prev => ({ ...prev, latitude: lat, longitude: lon }));
        setFieldErrors(prev => ({ ...prev, latitude: undefined, longitude: undefined }));
        // Reverse geocode using OpenStreetMap Nominatim (free, no key needed)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await res.json();
          const addr = data.address;
          const label = [
            addr.village || addr.town || addr.city || addr.county,
            addr.state_district || addr.district,
            addr.state,
          ].filter(Boolean).join(', ');
          setLocationLabel(label || `${lat}, ${lon}`);
        } catch {
          setLocationLabel(`${lat}, ${lon}`);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (!isAuto) {
          if (err.code === err.PERMISSION_DENIED) {
            setError('Location permission denied. Please allow location access in your browser.');
          } else {
            setError('Unable to detect location. Please enter coordinates manually.');
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!profileId) {
      // Auto-detect live location on mount silently for new profiles
      detectLocation(true);
      return;
    }
    setLoading(true);
    soilApi
      .get(profileId)
      .then((res) => {
        const d = res.data?.data ?? res.data;
        setForm({
          plotName: d.plotName ?? '',
          latitude: d.latitude != null ? String(d.latitude) : '',
          longitude: d.longitude != null ? String(d.longitude) : '',
          soilType: d.soilType ?? '',
          ph: d.ph != null ? String(d.ph) : '',
          nitrogen: d.nitrogen != null ? String(d.nitrogen) : '',
          phosphorus: d.phosphorus != null ? String(d.phosphorus) : '',
          potassium: d.potassium != null ? String(d.potassium) : '',
        });
      })
      .catch((err: unknown) => {
        const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
        setError(
          axiosErr.response?.data?.error ||
            axiosErr.response?.data?.message ||
            'Failed to load soil profile.',
        );
      })
      .finally(() => setLoading(false));
  }, [profileId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload = {
      plotName: form.plotName.trim(),
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      soilType: form.soilType.trim(),
      ph: parseFloat(form.ph),
      nitrogen: parseFloat(form.nitrogen),
      phosphorus: parseFloat(form.phosphorus),
      potassium: parseFloat(form.potassium),
    };

    setSaving(true);
    try {
      if (isEdit && profileId) {
        await soilApi.update(profileId, payload);
        setSuccess('Soil profile updated successfully.');
      } else {
        await soilApi.create(payload);
        setSuccess('Soil profile created successfully.');
        setForm(EMPTY_FORM);
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: string; message?: string; errors?: FieldErrors } };
      };
      const serverErrors = axiosErr.response?.data?.errors;
      if (serverErrors) {
        setFieldErrors(serverErrors);
      }
      setError(
        axiosErr.response?.data?.error ||
          axiosErr.response?.data?.message ||
          'Failed to save soil profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
        <p>Loading soil profile…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24 }}>{isEdit ? 'Edit Soil Profile' : 'Add Soil Profile'}</h2>

      {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
      {success && <p style={{ color: 'green', marginBottom: 12 }}>{success}</p>}

      <form onSubmit={handleSubmit} noValidate>
        {/* Plot Name */}
        <div style={fieldStyle}>
          <label htmlFor="plotName" style={labelStyle}>Plot Name</label>
          <input
            id="plotName"
            name="plotName"
            type="text"
            value={form.plotName}
            onChange={handleChange}
            placeholder="e.g. North Field"
            style={inputStyle}
          />
          {fieldErrors.plotName && <p style={errorStyle}>{fieldErrors.plotName}</p>}
        </div>

        {/* Location Detection */}
        <div style={{ ...fieldStyle, background: '#f1f8e9', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontWeight: 600 }}>📍 Field Location</label>
            <button
              type="button"
              onClick={detectLocation}
              disabled={locating}
              style={{
                background: 'var(--green-dark, #2e7d32)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                cursor: locating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {locating ? '⏳ Detecting…' : '🎯 Detect My Location'}
            </button>
          </div>
          {locationLabel && (
            <div style={{ fontSize: 13, color: '#2e7d32', marginBottom: 8, fontStyle: 'italic' }}>
              📌 {locationLabel}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor="latitude" style={{ ...labelStyle, fontSize: 13 }}>Latitude</label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="any"
                value={form.latitude}
                onChange={handleChange}
                placeholder="e.g. 30.7333"
                style={{ ...inputStyle, fontSize: 14 }}
              />
              {fieldErrors.latitude && <p style={errorStyle}>{fieldErrors.latitude}</p>}
            </div>
            <div>
              <label htmlFor="longitude" style={{ ...labelStyle, fontSize: 13 }}>Longitude</label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="any"
                value={form.longitude}
                onChange={handleChange}
                placeholder="e.g. 76.7794"
                style={{ ...inputStyle, fontSize: 14 }}
              />
              {fieldErrors.longitude && <p style={errorStyle}>{fieldErrors.longitude}</p>}
            </div>
          </div>
        </div>

        {/* Soil Type */}
        <div style={fieldStyle}>
          <label htmlFor="soilType" style={labelStyle}>Soil Type</label>
          <input
            id="soilType"
            name="soilType"
            type="text"
            value={form.soilType}
            onChange={handleChange}
            placeholder="e.g. Loamy, Sandy, Clay"
            style={inputStyle}
          />
          {fieldErrors.soilType && <p style={errorStyle}>{fieldErrors.soilType}</p>}
        </div>

        {/* pH */}
        <div style={fieldStyle}>
          <label htmlFor="ph" style={labelStyle}>pH (0–14)</label>
          <input
            id="ph"
            name="ph"
            type="number"
            step="0.1"
            min="0"
            max="14"
            value={form.ph}
            onChange={handleChange}
            placeholder="e.g. 6.5"
            style={inputStyle}
          />
          {fieldErrors.ph && <p style={errorStyle}>{fieldErrors.ph}</p>}
        </div>

        {/* Nitrogen */}
        <div style={fieldStyle}>
          <label htmlFor="nitrogen" style={labelStyle}>Nitrogen (kg/acre)</label>
          <input
            id="nitrogen"
            name="nitrogen"
            type="number"
            step="0.01"
            min="0"
            value={form.nitrogen}
            onChange={handleChange}
            placeholder="e.g. 40"
            style={inputStyle}
          />
          {fieldErrors.nitrogen && <p style={errorStyle}>{fieldErrors.nitrogen}</p>}
        </div>

        {/* Phosphorus */}
        <div style={fieldStyle}>
          <label htmlFor="phosphorus" style={labelStyle}>Phosphorus (kg/acre)</label>
          <input
            id="phosphorus"
            name="phosphorus"
            type="number"
            step="0.01"
            min="0"
            value={form.phosphorus}
            onChange={handleChange}
            placeholder="e.g. 20"
            style={inputStyle}
          />
          {fieldErrors.phosphorus && <p style={errorStyle}>{fieldErrors.phosphorus}</p>}
        </div>

        {/* Potassium */}
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="potassium" style={labelStyle}>Potassium (kg/acre)</label>
          <input
            id="potassium"
            name="potassium"
            type="number"
            step="0.01"
            min="0"
            value={form.potassium}
            onChange={handleChange}
            placeholder="e.g. 30"
            style={inputStyle}
          />
          {fieldErrors.potassium && <p style={errorStyle}>{fieldErrors.potassium}</p>}
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: 16,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : isEdit ? 'Update Profile' : 'Create Profile'}
        </button>
      </form>

      {onNavigate && (
        <p style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontSize: 14 }}
          >
            ← Back to Home
          </button>
        </p>
      )}
    </div>
  );
};

export default SoilProfilePage;
