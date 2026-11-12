# rdv-sim

Simulação de transferência de votos (Presidente) a partir dos arquivos RDV do TSE 2026.

## Requisitos

- Node.js 18 ou superior

## Instalação

```bash
npm install
```

## Interface web (recomendado)

```bash
npm start
```

Abra no navegador: http://localhost:3000

1. Selecione estado → município → zona → seção
2. A simulação roda automaticamente
3. O resultado aparece na mesma página

## Linha de comando

```bash
node bin/simular.js <estado> <cidade> <zona> <secao>
```

Exemplo:

```bash
node bin/simular.js sp 69272 0195 0034
```

## Estrutura

```
rdv-sim/
├── server.js                 ← servidor HTTP + API
├── package.json
├── public/
│   └── index.html            ← interface
├── bin/
│   └── simular.js            ← CLI
└── lib/
    ├── extrair-presidente.js ← decoder BER do RDV
    ├── getRdv.js             ← download JWS/RDV
    └── simularCore.js        ← lógica da simulação
```
