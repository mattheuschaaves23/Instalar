import { useEffect, useRef, useState } from 'react';

const steps = [
  { title: 'Deixe o perfil com a sua cara', text: 'Em Perfil, escolha sua foto e escreva uma bio curta para apresentar seu trabalho. Em Publicações, adicione fotos das instalações e escolha qual vira capa.' },
  { title: 'Confira os dados para pedidos', text: 'Nome, telefone, cidade, estado e e-mail confirmado são os únicos dados obrigatórios para aceitar pedidos. Foto, publicações e certificado são opcionais.' },
  { title: 'Organize seu atendimento', text: 'Na seção Atendimento, ajuste sua região, horários e valores. Edite as seções na ordem que quiser e use Salvar alterações ao terminar cada uma.' },
];

export default function ProfileEditTutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const dialog = useRef(null);
  const title = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    title.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  useEffect(() => { title.current?.focus(); }, [step]);

  const handleKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return (
    <div className="profile-tutorial-backdrop">
      <section aria-describedby="profile-tutorial-description" aria-labelledby="profile-tutorial-title" aria-modal="true" className="profile-tutorial" onKeyDown={handleKey} ref={dialog} role="dialog">
        <div className="profile-tutorial-top"><span>Como editar seu perfil · {step + 1} de 3</span><button aria-label="Fechar tutorial" onClick={onClose} type="button">×</button></div>
        <h2 id="profile-tutorial-title" ref={title} tabIndex={-1}>{steps[step].title}</h2>
        <p id="profile-tutorial-description">{steps[step].text}</p>
        <p className="profile-tutorial-hint">Você pode rever este guia pelo botão “Ver tutorial”.</p>
        <div className="profile-tutorial-progress" aria-hidden="true">{steps.map((item, index) => <i className={index <= step ? 'is-active' : ''} key={item.title} />)}</div>
        <footer><button className="ghost-button" onClick={onClose} type="button">Pular tutorial</button><div>{step > 0 ? <button className="ghost-button" onClick={() => setStep(step - 1)} type="button">Anterior</button> : null}<button className="gold-button" onClick={() => step === 2 ? onClose() : setStep(step + 1)} type="button">{step === 2 ? 'Começar a editar' : 'Próximo'}</button></div></footer>
      </section>
    </div>
  );
}
