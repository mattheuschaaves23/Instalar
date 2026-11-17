import { getInstallerRequirements } from '../../utils/installerRequirements';

export default function ProfileReadiness({ profile, onEdit }) {
  const requirements = getInstallerRequirements(profile);
  const complete = requirements.filter((item) => item.complete).length;
  const ready = complete === requirements.length;
  return (
    <section aria-label="Requisitos para aceitar pedidos" className={`profile-readiness${ready ? ' is-ready' : ''}`}>
      <div className="profile-readiness-heading">
        <div><strong>{ready ? 'Pronto para aceitar pedidos' : 'Falta pouco para aceitar pedidos'}</strong>
          <p>{ready ? 'Seus cinco dados essenciais estão completos.' : `${complete} de 5 requisitos concluídos nos dados salvos.`}</p></div>
        {onEdit && !ready ? <button className="ghost-button" onClick={onEdit} type="button">Completar dados</button> : null}
      </div>
      <ul>{requirements.map(({ field, label, complete: done }) => (
        <li data-complete={done} key={field}><span aria-hidden="true">{done ? '✓' : '○'}</span>{label}<small>{done ? 'Concluído' : 'Pendente'}</small></li>
      ))}</ul>
      <p className="profile-readiness-note">Foto, certificado e portfólio são opcionais e não bloqueiam o aceite de pedidos.</p>
    </section>
  );
}
