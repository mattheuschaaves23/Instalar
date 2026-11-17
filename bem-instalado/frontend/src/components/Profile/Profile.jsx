import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import InstallerProfile from '../Public/InstallerProfile';
import DecoratingWallLoader from '../Layout/DecoratingWallLoader';
import ProfileEditor from './ProfileEditor';
import ProfileReadiness from './ProfileReadiness';
import { getProfileEditSection } from './profileEditing';
import { buildOwnerProfilePreview } from './profilePresentation';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [publicPreview, setPublicPreview] = useState(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editorMounted, setEditorMounted] = useState(false);
  const editing = params.get('editar') === '1';
  useEffect(() => { if (editing) setEditorMounted(true); }, [editing]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setProfile(null);
    setPublicPreview(null);
    setPreviewUnavailable(false);
    api.get('/users/profile', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setProfile(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.response?.data?.error || 'Não foi possível carregar seu perfil. Seus dados não foram alterados.'); });
    return () => controller.abort();
  }, [user?.id, attempt]);

  const [previewAttempt, setPreviewAttempt] = useState(0);
  useEffect(() => {
    if (!profile?.id || editing) return undefined;
    const controller = new AbortController();
    setPreviewUnavailable(false);
    // The public endpoint already offers an authenticated owner preview, even before publication.
    api.get(`/public/installers/${profile.id}`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (Number(data?.installer?.id) === Number(profile.id)) setPublicPreview(data);
        else setPreviewUnavailable(true);
      })
      .catch(() => { if (!controller.signal.aborted) setPreviewUnavailable(true); });
    return () => controller.abort();
  }, [profile?.id, editing, previewAttempt]);

  const fallbackPreview = useMemo(() => buildOwnerProfilePreview(profile || {}), [profile]);
  const preview = Number(publicPreview?.installer?.id) === Number(profile?.id) ? publicPreview : fallbackPreview;
  const openRequiredData = useCallback(() => navigate('/profile?editar=1&secao=dados'), [navigate]);
  const restoreEditor = useCallback(() => navigate('/profile?editar=1'), [navigate]);
  const closeEditor = useCallback(() => setEditorMounted(false), []);
  const showProfile = useCallback(() => { closeEditor(); navigate('/profile', { replace: true }); }, [closeEditor, navigate]);
  if (error) return <section className="page-shell profile-owner-page profile-load-error" role="alert"><h1>Seu perfil não carregou</h1><p>{error}</p><button className="gold-button" onClick={() => setAttempt((value) => value + 1)} type="button">Tentar novamente</button></section>;
  if (!profile) return <DecoratingWallLoader embedded phrase="Abrindo seu perfil profissional." />;
  return <>
    {editing || editorMounted ? <ProfileEditor active={editing} initialProfile={profile} initialSection={getProfileEditSection(params.get('secao'))} onBack={closeEditor} onResume={restoreEditor} onCancel={showProfile} onSaved={(savedProfile) => { setProfile(savedProfile); setPublicPreview(null); showProfile(); }} /> : null}
    {!editing ? (
    <div className="page-shell profile-owner-page">
      <header className="profile-owner-heading"><div><h2>Meu perfil</h2><p>Veja sua apresentação como o cliente vê. Para mudar os dados, toque em Editar perfil.</p></div></header>
      <ProfileReadiness profile={profile} onEdit={openRequiredData} />
      {!profile.public_profile ? <p className="profile-visibility-note">Esta é sua prévia. Seu perfil ainda não está na busca pública; isso não impede aceitar pedidos quando os dados essenciais estão completos.</p> : null}
      {previewUnavailable ? <p className="profile-visibility-note" role="status">Não foi possível atualizar avaliações ou agenda. <button className="profile-inline-button" onClick={() => setPreviewAttempt((value) => value + 1)} type="button">Tentar novamente</button></p> : null}
      <InstallerProfile ownerPreview={preview} />
    </div>
    ) : null}
  </>;
}
