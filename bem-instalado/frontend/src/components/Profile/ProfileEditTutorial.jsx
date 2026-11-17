import { useEffect, useRef, useState } from 'react';

const steps = [
  { title: 'Comece pelo essencial', text: 'Preencha nome, telefone, cidade e estado. Confirme também o e-mail da sua conta. Só esses cinco itens são necessários para aceitar pedidos.' },
  { title: 'Mostre seu trabalho', text: 'Adicione sua foto, apresentação e fotos das instalações. Certificado e portfólio são opcionais; você pode completar depois.' },
  { title: 'Organize seu atendimento', text: 'Defina sua região, horários e valores. Use Salvar e continuar para guardar cada etapa, ou Salvar e ver perfil para conferir o resultado.' },
];

export default function ProfileEditTutorial({ onClose, onStepChange }) {
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
  const goTo = (next) => { setStep(next); onStepChange(next); };

  return (
    <div className="profile-tutorial-backdrop">
      <section aria-describedby="profile-tutorial-description" aria-labelledby="profile-tutorial-title" aria-modal="true" className="profile-tutorial" onKeyDown={handleKey} ref={dialog} role="dialog">
        <div className="profile-tutorial-top"><span>Como editar seu perfil · {step + 1} de 3</span><button aria-label="Fechar tutorial" onClick={onClose} type="button">×</button></div>
        <h2 id="profile-tutorial-title" ref={title} tabIndex={-1}>{steps[step].title}</h2>
        <p id="profile-tutorial-description">{steps[step].text}</p>
        <p className="profile-tutorial-hint">Você pode rever este guia pelo botão “Ver tutorial”.</p>
        <div className="profile-tutorial-progress" aria-hidden="true">{steps.map((item, index) => <i className={index <= step ? 'is-active' : ''} key={item.title} />)}</div>
        <footer><button className="ghost-button" onClick={onClose} type="button">Pular tutorial</button><div>{step > 0 ? <button className="ghost-button" onClick={() => goTo(step - 1)} type="button">Anterior</button> : null}<button className="gold-button" onClick={() => step === 2 ? onClose() : goTo(step + 1)} type="button">{step === 2 ? 'Começar a editar' : 'Próximo'}</button></div></footer>
      </section>
    </div>
  );
}
