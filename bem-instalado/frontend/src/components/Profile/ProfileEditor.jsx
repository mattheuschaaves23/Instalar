import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useBeforeUnload, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { installationDayOptions } from '../../utils/installerDays';
import { useSubscription } from '../../contexts/SubscriptionContext';
import PlanUsage from '../Subscription/PlanUsage';
import { safeLocalStorage } from '../../utils/safeStorage';
import ProfileReadiness from './ProfileReadiness';
import ProfileEditTutorial from './ProfileEditTutorial';
import { buildProfileStepPayload, clearProfileDraft, PROFILE_EDIT_STEPS, profileTutorialKey, readProfileDraft, rememberProfileDraft } from './profileEditing';
import { resolveProfileImage } from './profileMedia';

const initialForm = {
  name: '',
  phone: '',
  logo: '',
  installer_photo: '',
  installation_gallery: [],
  certificate_file: '',
  certificate_name: '',
  certification_verified: false,
  featured_installer: false,
  business_name: '',
  city: '',
  state: '',
  service_radius_km: 80,
  service_region: '',
  bio: '',
  installation_method: '',
  service_hours: '',
  installation_days: [],
  default_price_per_roll: 0,
  default_removal_price: 0,
  base_service_cost: 0,
  travel_fee: 0,
  monthly_goal: 5000,
  public_profile: false,
  years_experience: 0,
  wallpaper_store_recommended: true,
  document_type: 'cpf',
  document_id: '',
  emergency_contact: '',
  emergency_phone: '',
  safety_notes: '',
  accepts_service_contract: true,
  provides_warranty: true,
  warranty_days: 90,
};

const initialSlotForm = {
  slot_date: '',
  start_time: '08:00',
  end_time: '10:00',
};

const imageHint = 'PNG, JPG ou WEBP (máx. 3MB). A imagem é salva no perfil.';
const certificateHint = 'Opcional. PDF, PNG, JPG ou WEBP (máx. 4MB). A análise libera o selo de verificado; não é necessária para aceitar pedidos.';

function buildMonthKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function buildDateKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatSlotDate(value) {
  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function isImageFile(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isPdfFile(value) {
  return typeof value === 'string' && value.startsWith('data:application/pdf');
}

function getDocumentTypeLabel(type) {
  if (type === 'cnpj') {
    return 'CNPJ';
  }

  if (type === 'rg') {
    return 'RG';
  }

  return 'CPF';
}

function normalizeProfilePayload(payload) {
  const safePayload = payload || {};
  const gallery = Array.isArray(safePayload.installation_gallery)
    ? safePayload.installation_gallery
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  return {
    ...initialForm,
    ...safePayload,
    installation_gallery: gallery,
  };
}

export default function ProfileEditor({ active, initialProfile, onSaved, onCancel, onBack, onResume }) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { setUser, user } = useAuth();
  const { isPro, planAccess, refreshSubscription } = useSubscription();
  const [restoredDraft] = useState(() => readProfileDraft(initialProfile.id));
  const [form, setForm] = useState(() => normalizeProfilePayload({ ...initialProfile, ...restoredDraft?.changes }));
  const [savedProfile, setSavedProfile] = useState(() => normalizeProfilePayload(initialProfile));
  const [editStep, setEditStep] = useState(restoredDraft?.step ?? 0);
  const [tutorialOpen, setTutorialOpen] = useState(() => !restoredDraft && !safeLocalStorage.getItem(profileTutorialKey(initialProfile.id)));
  const stepTitle = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [availabilityMonth, setAvailabilityMonth] = useState(buildMonthKey());
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotForm, setSlotForm] = useState(() => ({
    ...initialSlotForm,
    slot_date: buildDateKey(),
  }));

  const dirty = useMemo(() => JSON.stringify(buildProfileStepPayload(form, editStep)) !== JSON.stringify(buildProfileStepPayload(savedProfile, editStep)), [editStep, form, savedProfile]);
  const busy = saving || uploading > 0 || slotSaving;
  const emailVerified = Boolean(user?.email_verified || savedProfile.email_verified || savedProfile.email_verified_at);
  const closeTutorial = () => {
    safeLocalStorage.setItem(profileTutorialKey(initialProfile.id), 'seen');
    setTutorialOpen(false);
    setEditStep(0);
  };
  const canDiscard = useCallback(async () => !dirty || confirm({
    title: 'Descartar alterações não salvas?', message: 'As alterações desta etapa ainda não foram salvas. O que você já salvou será mantido.',
    confirmText: 'Descartar alterações', cancelText: 'Continuar editando', tone: 'danger',
  }), [confirm, dirty]);
  const discardDraft = useCallback(() => clearProfileDraft(initialProfile.id), [initialProfile.id]);
  const cancelEditing = async () => { if (!busy && await canDiscard()) { discardDraft(); onCancel(); } };
  const changeStep = async (next) => {
    if (busy || next === editStep || !(await canDiscard())) return;
    setForm(savedProfile);
    setEditStep(next);
  };
  useLayoutEffect(() => {
    if (active) rememberProfileDraft(initialProfile.id, editStep, form, savedProfile);
  }, [active, editStep, form, initialProfile.id, savedProfile]);
  useBeforeUnload(useCallback((event) => {
    if (!active || (!dirty && !busy)) return;
    event.preventDefault(); event.returnValue = '';
  }, [active, busy, dirty]));
  useEffect(() => { if (active && !tutorialOpen) stepTitle.current?.focus(); }, [active, editStep, tutorialOpen]);
  useEffect(() => {
    if (active) return undefined;
    // Keep this editor mounted while a back navigation returns to the presentation.
    if (busy) { onResume(); return undefined; }
    if (!dirty) { onBack(); return undefined; }
    let current = true;
    void canDiscard().then((discard) => {
      if (!current) return;
      if (discard) { discardDraft(); onBack(); }
      else onResume();
    });
    return () => { current = false; };
  }, [active, busy, canDiscard, dirty, discardDraft, onBack, onResume]);
  useEffect(() => {
    if (!active || (!dirty && !busy)) return undefined;
    const onLink = async (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = link.href;
      if (!/^https?:/.test(href) || href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      if (busy || !(await canDiscard())) return;
      discardDraft();
      setForm(savedProfile);
      const destination = new URL(href);
      if (destination.origin === window.location.origin) navigate(destination.pathname + destination.search + destination.hash);
      else window.location.assign(href);
    };
    document.addEventListener('click', onLink, true);
    return () => { document.removeEventListener('click', onLink, true); };
  }, [active, busy, canDiscard, dirty, discardDraft, navigate, savedProfile]);

  const loadAvailabilitySlots = useCallback(async (monthValue = availabilityMonth) => {
    setAvailabilityLoading(true);

    try {
      const response = await api.get('/users/availability', {
        params: { month: monthValue },
      });
      setAvailabilitySlots(response.data?.slots || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os horários vagos.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [availabilityMonth]);

  useEffect(() => {
    if (editStep === 2 && emailVerified) void loadAvailabilitySlots(availabilityMonth);
  }, [availabilityMonth, editStep, emailVerified, loadAvailabilitySlots]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const toggleInstallationDay = (day) => {
    setForm((current) => ({
      ...current,
      installation_days: current.installation_days.includes(day)
        ? current.installation_days.filter((item) => item !== day)
        : [...current.installation_days, day],
    }));
  };

  const handleImageUpload = async (fieldName, file) => {
    if (!file) {
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    if (!allowed.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 3MB.');
      return;
    }

    setUploading((count) => count + 1);
    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('kind', fieldName === 'logo' ? 'logo' : 'installer-photo');
      const response = await api.post('/users/uploads', payload);
      setForm((current) => ({ ...current, [fieldName]: response.data.url }));
      toast.success('Imagem carregada. Clique em salvar para aplicar.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível armazenar essa imagem.');
    } finally {
      setUploading((count) => count - 1);
    }
  };

  const handleGalleryUpload = async (files) => {
    const fileList = Array.from(files || []);

    if (!fileList.length) {
      return;
    }

    const currentGallery = Array.isArray(form.installation_gallery) ? form.installation_gallery : [];
    const galleryLimit = planAccess.limits?.portfolio_photos ?? 10;
    const remainingSlots = Math.max(0, galleryLimit - currentGallery.length);

    if (remainingSlots <= 0) {
      toast.error(`Você já atingiu o limite de ${galleryLimit} fotos do seu plano.`);
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const selectedFiles = fileList.slice(0, remainingSlots);
    const uploadedItems = [];
    setUploading((count) => count + 1);
    for (const file of selectedFiles) {
      if (!allowed.includes(file.type)) {
        toast.error(`Formato inválido para "${file.name}". Use PNG, JPG ou WEBP.`);
        continue;
      }

      if (file.size > 3 * 1024 * 1024) {
        toast.error(`A foto "${file.name}" excede 3MB.`);
        continue;
      }

      try {
        const payload = new FormData();
        payload.append('file', file);
        payload.append('kind', 'gallery');
        const response = await api.post('/users/uploads', payload);
        uploadedItems.push(response.data.url);
      } catch (error) {
        toast.error(error.response?.data?.error || `Não foi possível armazenar a foto "${file.name}".`);
      }
    }

    setUploading((count) => count - 1);
    if (!uploadedItems.length) {
      return;
    }

    setForm((current) => ({
      ...current,
      installation_gallery: [...(current.installation_gallery || []), ...uploadedItems].slice(0, galleryLimit),
    }));
    toast.success(`${uploadedItems.length} foto(s) adicionada(s) ao portfólio.`);
  };

  const removeGalleryItem = (index) => {
    setForm((current) => ({
      ...current,
      installation_gallery: (current.installation_gallery || []).filter((_, position) => position !== index),
    }));
  };

  const handleCertificateUpload = async (file) => {
    if (!file) {
      return;
    }

    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];

    if (!allowed.includes(file.type)) {
      toast.error('Formato inválido. Envie PDF, PNG, JPG ou WEBP.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('O certificado deve ter no máximo 4MB.');
      return;
    }

    setUploading((count) => count + 1);
    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('kind', 'certificate');
      const response = await api.post('/users/uploads', payload);
      setForm((current) => ({
        ...current,
        certificate_file: response.data.url,
        certificate_name: file.name,
      }));
      toast.success('Certificado carregado. Clique em salvar para aplicar.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível armazenar esse arquivo de certificado.');
    } finally {
      setUploading((count) => count - 1);
    }
  };

  const clearCertificate = () => {
    setForm((current) => ({
      ...current,
      certificate_file: '',
      certificate_name: '',
      certification_verified: false,
    }));
  };

  const openStoredCertificate = async () => {
    if (!form.certificate_file.startsWith('/api/users/uploads/file/')) {
      toast.error('Este certificado precisa ser enviado novamente antes de abrir.');
      return;
    }

    const viewer = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const response = await api.get(form.certificate_file.replace(/^\/api/, ''), { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(response.data);
      if (viewer) viewer.location = objectUrl;
      else window.location.assign(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      viewer?.close();
      toast.error(error.response?.data?.error || 'Não foi possível abrir o certificado.');
    }
  };

  const handleSlotInputChange = (event) => {
    const { name, value } = event.target;
    setSlotForm((current) => ({ ...current, [name]: value }));
  };

  const createAvailabilitySlot = async () => {
    if (!slotForm.slot_date || !slotForm.start_time || !slotForm.end_time) {
      toast.error('Preencha data, hora inicial e hora final.');
      return;
    }

    setSlotSaving(true);

    try {
      await api.post('/users/availability', slotForm);
      toast.success('Horário vago adicionado.');
      await Promise.all([loadAvailabilitySlots(availabilityMonth), refreshSubscription()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível adicionar o horário.');
    } finally {
      setSlotSaving(false);
    }
  };

  const removeAvailabilitySlot = async (slotId) => {
    const confirmed = await confirm({
      title: 'Remover horário',
      message: 'Deseja remover este horário vago?',
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/users/availability/${slotId}`);
      toast.success('Horário removido.');
      await Promise.all([loadAvailabilitySlots(availabilityMonth), refreshSubscription()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível remover o horário.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const finish = event.nativeEvent.submitter?.value !== 'next';
    const payload = buildProfileStepPayload(form, editStep);
    setSaving(true);

    try {
      const response = await api.put('/users/profile', payload);
      const saved = normalizeProfilePayload(response.data);
      discardDraft();
      setForm(saved);
      setSavedProfile(saved);
      setUser((current) => ({ ...current, ...response.data }));
      await refreshSubscription();
      toast.success('Alterações salvas.');
      onSaved(response.data, finish || editStep === 2);
      if (!finish && editStep < 2) setEditStep((step) => step + 1);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-shell profile-editor-page" hidden={!active}>
      <div inert={tutorialOpen ? true : undefined}>
      <header className="profile-editor-heading">
        <div><button className="profile-inline-button" disabled={busy} onClick={cancelEditing} type="button">← Voltar ao meu perfil</button><h1>Editar perfil</h1><p>Uma etapa de cada vez. Salve para conferir o resultado no seu perfil.</p></div>
        <button className="ghost-button" disabled={busy} onClick={async () => { if (await canDiscard()) { setForm(savedProfile); setEditStep(0); setTutorialOpen(true); } }} type="button">Ver tutorial</button>
      </header>
      <ProfileReadiness profile={savedProfile} />
      <nav aria-label="Etapas de edição" className="profile-edit-steps">
        {PROFILE_EDIT_STEPS.map((step, index) => <button aria-current={editStep === index ? 'step' : undefined} className={editStep === index ? 'is-current' : ''} disabled={busy} key={step.title} onClick={() => changeStep(index)} type="button"><span>{index + 1}</span>{step.title}</button>)}
      </nav>
      <form className="profile-editor-form" onSubmit={handleSubmit}>
        <header className="profile-edit-section-heading"><div><p>Etapa {editStep + 1} de 3{editStep > 0 ? ' · Opcional' : ''}</p><h2 ref={stepTitle} tabIndex={-1}>{PROFILE_EDIT_STEPS[editStep].title}</h2><p>{PROFILE_EDIT_STEPS[editStep].description}</p></div><span role="status">{busy ? 'Aguarde…' : dirty ? 'Alterações não salvas' : 'Dados salvos'}</span></header>
        {!emailVerified ? <p className="profile-editor-email-note">Antes de salvar, confirme seu e-mail pelo link recebido. Use “Reenviar link” no aviso acima, caso precise.</p> : null}
        <fieldset className="profile-editor-fields" disabled={editStep !== 0 || busy} hidden={editStep !== 0}>
          <legend className="sr-only">Dados essenciais</legend>
            <label className="block">
              <span className="field-label">Nome do responsável · essencial</span>
              <input className="field-input" name="name" onChange={handleChange} value={form.name || ''} />
            </label>

            <label className="block">
              <span className="field-label">Telefone · essencial</span>
              <input className="field-input" name="phone" onChange={handleChange} type="tel" autoComplete="tel" value={form.phone || ''} />
            </label>

            <label className="block">
              <span className="field-label">Cidade · essencial</span>
              <input className="field-input" autoComplete="address-level2" name="city" onChange={handleChange} value={form.city || ''} />
            </label>

            <label className="block">
              <span className="field-label">Estado (UF) · essencial</span>
              <input className="field-input" autoComplete="address-level1" maxLength={2} name="state" onChange={handleChange} placeholder="Ex.: SC" value={form.state || ''} />
            </label>
            <div className="md:col-span-2">
              <span className="field-label">E-mail da conta · essencial</span>
              <p className="text-sm">{form.email || 'Carregando e-mail…'}</p>
              <p className="field-hint">{emailVerified ? 'E-mail confirmado.' : 'Confirmação pendente. Confira sua caixa de entrada e o spam.'} Seu telefone e e-mail não ficam expostos nesta apresentação.</p>
            </div>
        </fieldset>
        <fieldset className="profile-editor-fields" disabled={editStep !== 1 || busy} hidden={editStep !== 1}>
          <legend className="sr-only">Apresentação opcional</legend>
            <label className="block">
              <span className="field-label">Nome da empresa</span>
              <input className="field-input" name="business_name" onChange={handleChange} placeholder="Ex.: Studio Papel e Parede" value={form.business_name || ''} />
            </label>
            <label className="block"><span className="field-label">Anos de experiência</span><input className="field-input" min="0" name="years_experience" onChange={handleChange} type="number" value={form.years_experience || 0} /></label>
            <label className="block md:col-span-2"><span className="field-label">Apresentação pública</span><textarea className="field-textarea" name="bio" onChange={handleChange} placeholder="Conte sua experiência, estilo de atendimento e diferenciais." rows="4" value={form.bio || ''} /></label>

            <label className="block md:col-span-2">
              <span className="field-label">Logo para perfil e PDF</span>
              <input
                className="field-input"
                onChange={(event) => handleImageUpload('logo', event.target.files?.[0])}
                disabled={!emailVerified}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">{imageHint}</p>
              {form.logo ? (
                <img
                  alt="Logo do instalador"
                  className="mt-3 h-20 w-20 rounded-[16px] border border-[var(--line)] object-cover"
                  src={resolveProfileImage(form.logo, api.defaults.baseURL)}
                />
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Foto do instalador</span>
              <input
                className="field-input"
                onChange={(event) => handleImageUpload('installer_photo', event.target.files?.[0])}
                disabled={!emailVerified}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Essa foto aparece no perfil público para reforçar a confiança.</p>
              {form.installer_photo ? (
                <img
                  alt="Foto do instalador"
                  className="mt-3 h-24 w-24 rounded-full border border-[var(--line)] object-cover"
                  src={resolveProfileImage(form.installer_photo, api.defaults.baseURL)}
                />
              ) : null}
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">
                Portfólio de instalações (até {planAccess.limits?.portfolio_photos ?? 10} fotos)
              </span>
              <input
                className="field-input"
                onChange={(event) => handleGalleryUpload(event.target.files)}
                disabled={!emailVerified}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
              />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Mostre ambientes já instalados para aumentar a confiança do cliente.
              </p>
              <PlanUsage className="mt-3" compact usageKey="portfolio_photos" />
              <div className="profile-gallery-grid mt-3">
                {(form.installation_gallery || []).map((photo, index) => (
                  <article
                    className="profile-gallery-item"
                    key={`${index}-${photo.slice(0, 24)}`}
                  >
                    <img
                      alt={`Portfólio ${index + 1}`}
                      className="h-28 w-full rounded-[12px] object-cover"
                      src={resolveProfileImage(photo, api.defaults.baseURL)}
                    />
                    <button
                      className="ghost-button mt-2 w-full !min-h-0 !px-3 !py-2 text-xs"
                      onClick={() => removeGalleryItem(index)}
                      type="button"
                    >
                      Remover foto
                    </button>
                  </article>
                ))}
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Certificado de instalador · opcional</span>
              <input
                className="field-input"
                onChange={(event) => handleCertificateUpload(event.target.files?.[0])}
                disabled={!emailVerified}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              />
              <p className="mt-2 text-xs text-[var(--muted)]">{certificateHint}</p>

              {form.certificate_file ? (
                <div className="mt-3 rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-pill" data-tone={form.certification_verified ? 'success' : 'pending'}>
                      {form.certification_verified ? 'Certificado verificado pelo ADM' : 'Aguardando validação do ADM'}
                    </span>
                    {form.featured_installer ? (
                      <span className="status-pill" data-tone="success">
                        Perfil destacado na vitrine
                      </span>
                    ) : null}
                  </div>

                  {isImageFile(form.certificate_file) ? (
                    <img
                      alt="Certificado do instalador"
                      className="mt-3 max-h-56 w-full rounded-[14px] border border-[var(--line)] object-contain bg-white"
                      src={form.certificate_file}
                    />
                  ) : null}

                  {isPdfFile(form.certificate_file) ? (
                    <a
                      className="gold-button mt-3 w-full justify-center"
                      href={form.certificate_file}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir certificado em PDF
                    </a>
                  ) : null}

                  {!form.certificate_file.startsWith('data:') ? (
                    <button className="gold-button mt-3 w-full justify-center" disabled={!emailVerified} onClick={openStoredCertificate} type="button">
                      Abrir certificado protegido
                    </button>
                  ) : null}

                  {form.certificate_name ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">Arquivo: {form.certificate_name}</p>
                  ) : null}

                  <button className="ghost-button mt-3 w-full" onClick={clearCertificate} type="button">
                    Remover certificado
                  </button>
                </div>
              ) : null}
            </label>

        </fieldset>
        <fieldset className="profile-editor-fields" disabled={editStep !== 2 || busy} hidden={editStep !== 2}>
          <legend className="sr-only">Atendimento e informações complementares opcionais</legend>
            <label className="block md:col-span-2">
              <span className="field-label">Região que atende</span>
              <input
                className="field-input"
                name="service_region"
                onChange={handleChange}
                placeholder="Bairros, cidades próximas ou área principal"
                value={form.service_region || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Raio de atendimento (km)</span>
              <input
                className="field-input"
                max="250"
                min="10"
                name="service_radius_km"
                onChange={handleChange}
                type="number"
                value={form.service_radius_km || 80}
              />
              <span className="field-hint">Pedidos dentro desse raio podem aparecer como oportunidades.</span>
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Como instala</span>
              <textarea
                className="field-textarea"
                name="installation_method"
                onChange={handleChange}
                placeholder="Explique seu processo, acabamento, limpeza e preparação de parede."
                rows="4"
                value={form.installation_method || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Horários de atendimento</span>
              <input
                className="field-input"
                name="service_hours"
                onChange={handleChange}
                placeholder="Ex.: Segunda a sexta, das 08h às 18h"
                value={form.service_hours || ''}
              />
            </label>

            <div className="md:col-span-2">
              <span className="field-label">Dias que instala</span>
              <div className="profile-toggle-list grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {installationDayOptions.map((day) => (
                  <label
                    className="profile-toggle-row"
                    key={day.value}
                  >
                    <input
                      checked={form.installation_days.includes(day.value)}
                      className="field-checkbox"
                      onChange={() => toggleInstallationDay(day.value)}
                      type="checkbox"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="profile-availability-shell md:col-span-2 rounded-[22px] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-5">
              <p className="field-hint">Os horários são salvos ao adicionar ou remover. As demais informações usam o botão Salvar no final desta etapa.</p>
              <PlanUsage className="mb-4" compact usageKey="availability_slots" />
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="field-label">Mês dos horários vagos</span>
                  <input
                    className="field-input"
                    onChange={(event) => setAvailabilityMonth(event.target.value || buildMonthKey())}
                    type="month"
                    value={availabilityMonth}
                  />
                </label>
                <button className="ghost-button" disabled={!emailVerified} onClick={() => loadAvailabilitySlots(availabilityMonth)} type="button">
                  Atualizar lista
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <label className="block md:col-span-2">
                  <span className="field-label">Data</span>
                  <input
                    className="field-input"
                    min={buildDateKey()}
                    name="slot_date"
                    onChange={handleSlotInputChange}
                    type="date"
                    value={slotForm.slot_date}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Início</span>
                  <input
                    className="field-input"
                    name="start_time"
                    onChange={handleSlotInputChange}
                    type="time"
                    value={slotForm.start_time}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Fim</span>
                  <input
                    className="field-input"
                    name="end_time"
                    onChange={handleSlotInputChange}
                    type="time"
                    value={slotForm.end_time}
                  />
                </label>
              </div>

              <button
                className="gold-button mt-4"
                disabled={!emailVerified || slotSaving || (
                  planAccess.limits?.availability_slots !== null
                  && Number(planAccess.usage?.availability_slots || 0) >= Number(planAccess.limits?.availability_slots || 0)
                )}
                onClick={createAvailabilitySlot}
                type="button"
              >
                {slotSaving ? 'Salvando horário...' : 'Adicionar horário vago'}
              </button>

              <div className="profile-slot-list mt-4">
                {availabilityLoading ? (
                  <div className="empty-state">Carregando horários vagos...</div>
                ) : null}

                {!availabilityLoading && availabilitySlots.length === 0 ? (
                  <div className="empty-state">
                    Nenhum horário vago cadastrado para este mês. Adicione acima para mostrar no perfil público.
                  </div>
                ) : null}

                {!availabilityLoading && availabilitySlots.length > 0
                  ? availabilitySlots.map((slot) => (
                      <div
                        className="profile-slot-row"
                        key={slot.id}
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {formatSlotDate(slot.slot_date)}
                          </p>
                          <p className="text-sm text-[var(--muted)]">
                            {slot.start_time} - {slot.end_time}
                          </p>
                        </div>
                        <button className="ghost-button" disabled={!emailVerified} onClick={() => removeAvailabilitySlot(slot.id)} type="button">
                          Remover
                        </button>
                      </div>
                    ))
                  : null}
              </div>
            </div>

            <label className="block">
              <span className="field-label">Preço por rolo</span>
              <input
                className="field-input"
                name="default_price_per_roll"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={form.default_price_per_roll || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Remoção por rolo/unidade</span>
              <input
                className="field-input"
                name="default_removal_price"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={form.default_removal_price || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Custo base da visita</span>
              <input
                className="field-input"
                name="base_service_cost"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={form.base_service_cost || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Taxa de deslocamento</span>
              <input
                className="field-input"
                name="travel_fee"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={form.travel_fee || 0}
              />
            </label>

            <label className="block">
              <span className="field-label">Meta mensal {isPro ? '' : '• Pro'}</span>
              <input
                className="field-input"
                disabled={!isPro}
                name="monthly_goal"
                onChange={handleChange}
                step="0.01"
                type="number"
                value={form.monthly_goal || 0}
              />
            </label>

            <label className="block"><span className="field-label">Tipo de documento · opcional</span><select className="field-select" name="document_type" onChange={handleChange} value={form.document_type || 'cpf'}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="rg">RG</option></select></label>
            <label className="block"><span className="field-label">Número do documento · privado e opcional</span><input className="field-input" name="document_id" onChange={handleChange} value={form.document_id || ''} /></label>

            <label className="block">
              <span className="field-label">Contato de emergência (privado)</span>
              <input
                className="field-input"
                name="emergency_contact"
                onChange={handleChange}
                placeholder="Nome do contato"
                value={form.emergency_contact || ''}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Este dado não aparece no perfil público.</p>
            </label>

            <label className="block">
              <span className="field-label">Telefone de emergência (privado)</span>
              <input
                className="field-input"
                name="emergency_phone"
                onChange={handleChange}
                placeholder="(xx) xxxxx-xxxx"
                value={form.emergency_phone || ''}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="field-label">Observações de segurança para o cliente</span>
              <textarea
                className="field-textarea"
                name="safety_notes"
                onChange={handleChange}
                placeholder="Ex.: uso de EPIs, proteção do ambiente, contrato formal e checklist de entrega."
                rows="3"
                value={form.safety_notes || ''}
              />
            </label>

            <label className="block">
              <span className="field-label">Garantia (dias)</span>
              <input
                className="field-input"
                min="0"
                name="warranty_days"
                onChange={handleChange}
                type="number"
                value={form.warranty_days || 0}
              />
            </label>

            <div className="profile-toggle-list md:col-span-2 grid gap-3">
              <label className="profile-toggle-row">
                <input
                  checked={Boolean(form.accepts_service_contract)}
                  className="field-checkbox"
                  name="accepts_service_contract"
                  onChange={handleChange}
                  type="checkbox"
                />
                Forneço contrato de serviço para o cliente
              </label>

              <label className="profile-toggle-row">
                <input
                  checked={Boolean(form.provides_warranty)}
                  className="field-checkbox"
                  name="provides_warranty"
                  onChange={handleChange}
                  type="checkbox"
                />
                Ofereço garantia do serviço
              </label>
            </div>

            <label className="profile-toggle-row md:col-span-2">
              <input
                checked={Boolean(form.public_profile)}
                className="field-checkbox"
                disabled
                readOnly
                type="checkbox"
              />
              {form.public_profile
                ? 'Perfil aprovado e visível na busca pública (opcional)'
                : 'A busca pública é liberada após análise. Isso não impede aceitar pedidos.'}
            </label>

            <label className="profile-toggle-row md:col-span-2">
              <input
                checked={Boolean(form.wallpaper_store_recommended)}
                className="field-checkbox"
                name="wallpaper_store_recommended"
                onChange={handleChange}
                type="checkbox"
              />
                      Mostrar a loja recomendada como opção de compra no meu perfil
            </label>
            <div className="md:col-span-2"><Link className="profile-inline-button" to="/instalador/recuperar-senha">Redefinir minha senha</Link></div>
        </fieldset>
        <footer className="profile-editor-footer"><button className="ghost-button" disabled={busy} onClick={cancelEditing} type="button">Cancelar</button><div>{editStep > 0 ? <button className="ghost-button" disabled={busy} onClick={() => changeStep(editStep - 1)} type="button">Etapa anterior</button> : null}<button className="ghost-button" disabled={busy || !emailVerified} name="editor_action" type="submit" value="finish">Salvar e ver perfil</button>{editStep < 2 ? <button className="gold-button" disabled={busy || !emailVerified} name="editor_action" type="submit" value="next">{saving ? 'Salvando…' : 'Salvar e continuar'}</button> : null}</div></footer>
      </form>
      </div>
      {tutorialOpen ? <ProfileEditTutorial onClose={closeTutorial} onStepChange={setEditStep} /> : null}
    </section>
  );
}
