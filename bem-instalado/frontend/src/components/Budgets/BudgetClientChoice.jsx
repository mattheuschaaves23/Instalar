import { useId, useLayoutEffect, useRef } from 'react';
import './BudgetClientChoice.css';

export default function BudgetClientChoice({ onSelect, onClose }) {
  const titleId = useId();
  const frameRef = useRef(null);
  const headingRef = useRef(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (frame && !frame.open) frame.showModal();
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function select(mode) {
    frameRef.current?.close(mode);
  }

  return (
    <dialog aria-describedby={`${titleId}-description`} aria-labelledby={titleId} className="client-form-modal budget-client-mode" onClose={(event) => {
      const mode = event.currentTarget.returnValue;
      if (mode === 'full' || mode === 'quick') onSelect(mode);
      else onClose();
    }} ref={frameRef}>
      <header className="client-form-header">
        <div>
          <p>Novo contato</p>
          <h2 id={titleId} ref={headingRef} tabIndex={-1}>Como você quer cadastrar o cliente?</h2>
          <span id={`${titleId}-description`}>Escolha se quer preencher o cadastro completo agora ou começar só com o nome.</span>
        </div>
        <button aria-label="Fechar escolha de cadastro" className="client-form-close" onClick={() => select('cancel')} type="button">×</button>
      </header>
      <div className="budget-client-mode-options">
        <button className="budget-client-mode-option" onClick={() => select('full')} type="button">
          <strong>Cadastrar cliente agora</strong><span>Preencher o cadastro completo e já usar os dados no orçamento.</span>
        </button>
        <button className="budget-client-mode-option" onClick={() => select('quick')} type="button">
          <strong>Cadastrar cliente depois</strong><span>Informar só o nome. Complete os dados quando quiser na página Clientes.</span>
        </button>
      </div>
    </dialog>
  );
}
