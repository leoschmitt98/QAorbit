USE [QA orbit];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
  QA Orbit - esquema base
  Estrategia:
  - Banco guarda entidades, relacionamento, metadados e caminhos
  - Storage fisico continua para arquivos pesados: DOCX/PDF, GIF, PNG, Word e anexos
*/

IF OBJECT_ID('dbo.Projetos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Projetos (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nome NVARCHAR(200) NOT NULL,
    Ativo BIT NOT NULL CONSTRAINT DF_Projetos_Ativo DEFAULT (1),
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_Projetos_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_Projetos_DataAtualizacao DEFAULT (SYSDATETIME())
  );

  CREATE UNIQUE INDEX UX_Projetos_Nome ON dbo.Projetos (Nome);
END
GO

IF OBJECT_ID('dbo.Areas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Areas (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nome NVARCHAR(120) NOT NULL,
    Ativo BIT NOT NULL CONSTRAINT DF_Areas_Ativo DEFAULT (1),
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_Areas_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_Areas_DataAtualizacao DEFAULT (SYSDATETIME())
  );

  CREATE UNIQUE INDEX UX_Areas_Nome ON dbo.Areas (Nome);
END
GO

IF OBJECT_ID('dbo.Modulos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Modulos (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nome NVARCHAR(200) NOT NULL,
    ProjetoId INT NOT NULL,
    PortalId INT NULL,
    Ativo BIT NOT NULL CONSTRAINT DF_Modulos_Ativo DEFAULT (1),
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_Modulos_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_Modulos_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Modulos_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id)
  );

  CREATE UNIQUE INDEX UX_Modulos_Projeto_Nome ON dbo.Modulos (ProjetoId, Nome);
  CREATE INDEX IX_Modulos_ProjetoId ON dbo.Modulos (ProjetoId);
END
GO

IF OBJECT_ID('dbo.ProjetoPortais', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProjetoPortais (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ProjetoId INT NOT NULL,
    Nome NVARCHAR(200) NOT NULL,
    Ativo BIT NOT NULL CONSTRAINT DF_ProjetoPortais_Ativo DEFAULT (1),
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ProjetoPortais_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_ProjetoPortais_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ProjetoPortais_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id)
  );

  CREATE UNIQUE INDEX UX_ProjetoPortais_Projeto_Nome ON dbo.ProjetoPortais (ProjetoId, Nome);
  CREATE INDEX IX_ProjetoPortais_ProjetoId ON dbo.ProjetoPortais (ProjetoId);
END
GO

IF COL_LENGTH('dbo.Modulos', 'PortalId') IS NULL
BEGIN
  ALTER TABLE dbo.Modulos ADD PortalId INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Modulos_ProjetoPortais')
BEGIN
  ALTER TABLE dbo.Modulos
  ADD CONSTRAINT FK_Modulos_ProjetoPortais FOREIGN KEY (PortalId) REFERENCES dbo.ProjetoPortais (Id);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Modulos_PortalId'
    AND object_id = OBJECT_ID('dbo.Modulos')
)
BEGIN
  CREATE INDEX IX_Modulos_PortalId ON dbo.Modulos (PortalId);
END
GO

IF OBJECT_ID('dbo.DocumentosFuncionais', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DocumentosFuncionais (
    DocumentoId NVARCHAR(80) NOT NULL PRIMARY KEY,
    ProjetoId INT NOT NULL,
    ModuloId INT NOT NULL,
    Titulo NVARCHAR(250) NOT NULL,
    TipoDocumento NVARCHAR(80) NOT NULL,
    Versao NVARCHAR(50) NULL,
    Resumo NVARCHAR(MAX) NULL,
    Autor NVARCHAR(150) NULL,
    TagsJson NVARCHAR(MAX) NULL,
    NomeArquivo NVARCHAR(255) NULL,
    CaminhoStorage NVARCHAR(500) NULL,
    DownloadUrl NVARCHAR(500) NULL,
    MimeType NVARCHAR(120) NULL,
    TamanhoBytes BIGINT NULL,
    Ativo BIT NOT NULL CONSTRAINT DF_DocumentosFuncionais_Ativo DEFAULT (1),
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_DocumentosFuncionais_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_DocumentosFuncionais_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_DocumentosFuncionais_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id),
    CONSTRAINT FK_DocumentosFuncionais_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id)
  );

  CREATE INDEX IX_DocumentosFuncionais_ProjetoModulo ON dbo.DocumentosFuncionais (ProjetoId, ModuloId);
END
GO

IF OBJECT_ID('dbo.Chamados', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Chamados (
    TicketId NVARCHAR(120) NOT NULL PRIMARY KEY,
    Titulo NVARCHAR(300) NOT NULL,
    DescricaoProblemaCliente NVARCHAR(MAX) NULL,
    ProjetoId INT NULL,
    TipoProduto NVARCHAR(50) NULL,
    AreaId INT NULL,
    PortalAreaNome NVARCHAR(120) NULL,
    ModuloId INT NULL,
    Ambiente NVARCHAR(120) NULL,
    Versao NVARCHAR(120) NULL,
    Origem NVARCHAR(80) NULL,
    BaseReferencia NVARCHAR(MAX) NULL,
    AccessUrl NVARCHAR(500) NULL,
    UsuarioAcesso NVARCHAR(150) NULL,
    SenhaAcesso NVARCHAR(150) NULL,
    EmpresaCodigo NVARCHAR(80) NULL,
    UnidadeCodigo NVARCHAR(80) NULL,
    BranchName NVARCHAR(255) NULL,
    ChangelogDev NVARCHAR(MAX) NULL,
    DocumentoBaseNome NVARCHAR(255) NULL,
    DocumentoBaseCaminho NVARCHAR(500) NULL,
    DocumentoBaseMimeType NVARCHAR(120) NULL,
    DocumentoBaseTamanhoBytes BIGINT NULL,
    CurrentStep INT NOT NULL CONSTRAINT DF_Chamados_CurrentStep DEFAULT (0),
    LifecycleStatus NVARCHAR(40) NOT NULL CONSTRAINT DF_Chamados_LifecycleStatus DEFAULT ('Em andamento'),
    PromptMode NVARCHAR(80) NULL,
    AiResponse NVARCHAR(MAX) NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_Chamados_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_Chamados_DataAtualizacao DEFAULT (SYSDATETIME()),
    DataFinalizacao DATETIME2(0) NULL,
    CONSTRAINT FK_Chamados_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id),
    CONSTRAINT FK_Chamados_Areas FOREIGN KEY (AreaId) REFERENCES dbo.Areas (Id),
    CONSTRAINT FK_Chamados_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id)
  );

  CREATE INDEX IX_Chamados_ProjetoModulo ON dbo.Chamados (ProjetoId, ModuloId);
  CREATE INDEX IX_Chamados_LifecycleStatus ON dbo.Chamados (LifecycleStatus);
END
GO

IF OBJECT_ID('dbo.ChamadoAnexosSuporte', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoAnexosSuporte (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    NomeArquivo NVARCHAR(255) NOT NULL,
    CaminhoStorage NVARCHAR(500) NULL,
    MimeType NVARCHAR(120) NULL,
    TamanhoBytes BIGINT NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoAnexosSuporte_DataCriacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoAnexosSuporte_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE
  );

  CREATE INDEX IX_ChamadoAnexosSuporte_TicketId ON dbo.ChamadoAnexosSuporte (TicketId);
END
GO

IF OBJECT_ID('dbo.ChamadoProblemas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoProblemas (
    TicketId NVARCHAR(120) NOT NULL PRIMARY KEY,
    DescricaoEstruturada NVARCHAR(MAX) NULL,
    AnaliseInicial NVARCHAR(MAX) NULL,
    ComportamentoEsperado NVARCHAR(MAX) NULL,
    ComportamentoRelatado NVARCHAR(MAX) NULL,
    DocumentacaoRelacionada NVARCHAR(MAX) NULL,
    DadosTeste NVARCHAR(MAX) NULL,
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoProblemas_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoProblemas_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.ChamadoRetestes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoRetestes (
    TicketId NVARCHAR(120) NOT NULL PRIMARY KEY,
    PreCondicoes NVARCHAR(MAX) NULL,
    GifName NVARCHAR(255) NULL,
    GifPreviewUrl NVARCHAR(500) NULL,
    GifStoragePath NVARCHAR(500) NULL,
    ComportamentoObtido NVARCHAR(MAX) NULL,
    StatusReteste NVARCHAR(40) NOT NULL CONSTRAINT DF_ChamadoRetestes_StatusReteste DEFAULT ('Parcial'),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoRetestes_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoRetestes_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.ChamadoRetesteQuadros', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoRetesteQuadros (
    QuadroId NVARCHAR(120) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    Nome NVARCHAR(255) NOT NULL,
    TimestampLabel NVARCHAR(50) NULL,
    Descricao NVARCHAR(MAX) NULL,
    FileName NVARCHAR(255) NULL,
    DownloadUrl NVARCHAR(500) NULL,
    CaminhoStorage NVARCHAR(500) NULL,
    PersistedAt DATETIME2(0) NULL,
    OrdemExibicao INT NOT NULL CONSTRAINT DF_ChamadoRetesteQuadros_OrdemExibicao DEFAULT (0),
    AnnotationsJson NVARCHAR(MAX) NULL,
    EditHistoryJson NVARCHAR(MAX) NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoRetesteQuadros_DataCriacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoRetesteQuadros_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE
  );

  CREATE INDEX IX_ChamadoRetesteQuadros_TicketId ON dbo.ChamadoRetesteQuadros (TicketId, OrdemExibicao);
END
GO

IF OBJECT_ID('dbo.ChamadoRetestePassos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoRetestePassos (
    PassoId NVARCHAR(120) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    Ordem INT NOT NULL,
    StatusPasso NVARCHAR(40) NOT NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoRetestePassos_DataCriacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoRetestePassos_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE
  );

  CREATE INDEX IX_ChamadoRetestePassos_TicketId ON dbo.ChamadoRetestePassos (TicketId, Ordem);
END
GO

IF OBJECT_ID('dbo.ChamadoRetestePassoQuadros', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoRetestePassoQuadros (
    PassoId NVARCHAR(120) NOT NULL,
    QuadroId NVARCHAR(120) NOT NULL,
    Ordem INT NOT NULL CONSTRAINT DF_ChamadoRetestePassoQuadros_Ordem DEFAULT (0),
    CONSTRAINT PK_ChamadoRetestePassoQuadros PRIMARY KEY (PassoId, QuadroId),
    CONSTRAINT FK_ChamadoRetestePassoQuadros_Passos FOREIGN KEY (PassoId) REFERENCES dbo.ChamadoRetestePassos (PassoId) ON DELETE CASCADE,
    CONSTRAINT FK_ChamadoRetestePassoQuadros_Quadros FOREIGN KEY (QuadroId) REFERENCES dbo.ChamadoRetesteQuadros (QuadroId) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.ChamadoCenariosComplementares', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoCenariosComplementares (
    CenarioId NVARCHAR(120) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    Descricao NVARCHAR(MAX) NOT NULL,
    ModuloId INT NULL,
    ResultadoEsperado NVARCHAR(MAX) NULL,
    ResultadoObtido NVARCHAR(MAX) NULL,
    StatusCenario NVARCHAR(40) NOT NULL CONSTRAINT DF_ChamadoCenariosComplementares_Status DEFAULT ('Parcial'),
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoCenariosComplementares_DataCriacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoCenariosComplementares_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE,
    CONSTRAINT FK_ChamadoCenariosComplementares_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id)
  );

  CREATE INDEX IX_ChamadoCenariosComplementares_TicketId ON dbo.ChamadoCenariosComplementares (TicketId);
END
GO

IF OBJECT_ID('dbo.ChamadoClassificacoes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoClassificacoes (
    TicketId NVARCHAR(120) NOT NULL PRIMARY KEY,
    Reutilizavel BIT NOT NULL CONSTRAINT DF_ChamadoClassificacoes_Reutilizavel DEFAULT (0),
    ModuloPrincipalId INT NULL,
    Criticidade NVARCHAR(30) NOT NULL CONSTRAINT DF_ChamadoClassificacoes_Criticidade DEFAULT ('Media'),
    CandidatoAutomacao BIT NOT NULL CONSTRAINT DF_ChamadoClassificacoes_CandidatoAutomacao DEFAULT (0),
    NomeAutomacao NVARCHAR(255) NULL,
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoClassificacoes_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoClassificacoes_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE,
    CONSTRAINT FK_ChamadoClassificacoes_ModuloPrincipal FOREIGN KEY (ModuloPrincipalId) REFERENCES dbo.Modulos (Id)
  );
END
GO

IF OBJECT_ID('dbo.ChamadoClassificacaoModulosImpactados', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoClassificacaoModulosImpactados (
    TicketId NVARCHAR(120) NOT NULL,
    ModuloId INT NOT NULL,
    CONSTRAINT PK_ChamadoClassificacaoModulosImpactados PRIMARY KEY (TicketId, ModuloId),
    CONSTRAINT FK_ChamadoClassificacaoModulosImpactados_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE,
    CONSTRAINT FK_ChamadoClassificacaoModulosImpactados_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id)
  );
END
GO

IF OBJECT_ID('dbo.ChamadoDocumentosSelecionadosPrompt', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoDocumentosSelecionadosPrompt (
    TicketId NVARCHAR(120) NOT NULL,
    DocumentoId NVARCHAR(80) NOT NULL,
    CONSTRAINT PK_ChamadoDocumentosSelecionadosPrompt PRIMARY KEY (TicketId, DocumentoId),
    CONSTRAINT FK_ChamadoDocumentosSelecionadosPrompt_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE,
    CONSTRAINT FK_ChamadoDocumentosSelecionadosPrompt_Documentos FOREIGN KEY (DocumentoId) REFERENCES dbo.DocumentosFuncionais (DocumentoId)
  );
END
GO

IF OBJECT_ID('dbo.Bugs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Bugs (
    BugId NVARCHAR(120) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    Titulo NVARCHAR(300) NOT NULL,
    ComportamentoEsperado NVARCHAR(MAX) NULL,
    ComportamentoObtido NVARCHAR(MAX) NULL,
    Severidade NVARCHAR(30) NOT NULL,
    Prioridade NVARCHAR(30) NOT NULL,
    StatusBug NVARCHAR(40) NOT NULL,
    ProjetoId INT NULL,
    ModuloId INT NULL,
    AreaId INT NULL,
    Ambiente NVARCHAR(120) NULL,
    Versao NVARCHAR(120) NULL,
    Origem NVARCHAR(80) NULL,
    BaseReferencia NVARCHAR(MAX) NULL,
    AccessUrl NVARCHAR(500) NULL,
    UsuarioAcesso NVARCHAR(150) NULL,
    SenhaAcesso NVARCHAR(150) NULL,
    EmpresaCodigo NVARCHAR(80) NULL,
    UnidadeCodigo NVARCHAR(80) NULL,
    BranchName NVARCHAR(255) NULL,
    ChangelogDev NVARCHAR(MAX) NULL,
    DescricaoProblemaChamado NVARCHAR(MAX) NULL,
    AnaliseInicial NVARCHAR(MAX) NULL,
    DocumentoBaseNome NVARCHAR(255) NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_Bugs_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_Bugs_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Bugs_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId),
    CONSTRAINT FK_Bugs_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id),
    CONSTRAINT FK_Bugs_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id),
    CONSTRAINT FK_Bugs_Areas FOREIGN KEY (AreaId) REFERENCES dbo.Areas (Id)
  );

  CREATE INDEX IX_Bugs_TicketId ON dbo.Bugs (TicketId);
  CREATE INDEX IX_Bugs_ProjetoModulo ON dbo.Bugs (ProjetoId, ModuloId);
END
GO

IF OBJECT_ID('dbo.BugPassosReproducao', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BugPassosReproducao (
    PassoId NVARCHAR(120) NOT NULL PRIMARY KEY,
    BugId NVARCHAR(120) NOT NULL,
    Ordem INT NOT NULL,
    DescricaoPasso NVARCHAR(MAX) NOT NULL,
    ResultadoObservado NVARCHAR(MAX) NULL,
    CONSTRAINT FK_BugPassosReproducao_Bugs FOREIGN KEY (BugId) REFERENCES dbo.Bugs (BugId) ON DELETE CASCADE
  );

  CREATE INDEX IX_BugPassosReproducao_BugId ON dbo.BugPassosReproducao (BugId, Ordem);
END
GO

IF OBJECT_ID('dbo.BugQuadros', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BugQuadros (
    QuadroId NVARCHAR(120) NOT NULL PRIMARY KEY,
    BugId NVARCHAR(120) NOT NULL,
    Nome NVARCHAR(255) NOT NULL,
    TimestampLabel NVARCHAR(50) NULL,
    Descricao NVARCHAR(MAX) NULL,
    FileName NVARCHAR(255) NULL,
    DownloadUrl NVARCHAR(500) NULL,
    CaminhoStorage NVARCHAR(500) NULL,
    PersistedAt DATETIME2(0) NULL,
    OrdemExibicao INT NOT NULL CONSTRAINT DF_BugQuadros_OrdemExibicao DEFAULT (0),
    AnnotationsJson NVARCHAR(MAX) NULL,
    EditHistoryJson NVARCHAR(MAX) NULL,
    CONSTRAINT FK_BugQuadros_Bugs FOREIGN KEY (BugId) REFERENCES dbo.Bugs (BugId) ON DELETE CASCADE
  );

  CREATE INDEX IX_BugQuadros_BugId ON dbo.BugQuadros (BugId, OrdemExibicao);
END
GO

IF OBJECT_ID('dbo.HistoricoTestes', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HistoricoTestes (
    HistoricoId NVARCHAR(120) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    BugId NVARCHAR(120) NULL,
    ProjetoId INT NULL,
    ModuloPrincipalId INT NULL,
    AreaId INT NULL,
    PortalAreaNome NVARCHAR(120) NULL,
    FluxoCenario NVARCHAR(300) NOT NULL,
    ResumoProblema NVARCHAR(MAX) NULL,
    ComportamentoEsperado NVARCHAR(MAX) NULL,
    ComportamentoObtido NVARCHAR(MAX) NULL,
    ResultadoFinal NVARCHAR(40) NOT NULL,
    Criticidade NVARCHAR(30) NOT NULL,
    TemAutomacao BIT NOT NULL CONSTRAINT DF_HistoricoTestes_TemAutomacao DEFAULT (0),
    FrameworkAutomacao NVARCHAR(50) NULL,
    CaminhoSpec NVARCHAR(500) NULL,
    PalavraChaveBusca NVARCHAR(MAX) NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_HistoricoTestes_DataCriacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_HistoricoTestes_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId),
    CONSTRAINT FK_HistoricoTestes_Bugs FOREIGN KEY (BugId) REFERENCES dbo.Bugs (BugId),
    CONSTRAINT FK_HistoricoTestes_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id),
    CONSTRAINT FK_HistoricoTestes_Modulos FOREIGN KEY (ModuloPrincipalId) REFERENCES dbo.Modulos (Id),
    CONSTRAINT FK_HistoricoTestes_Areas FOREIGN KEY (AreaId) REFERENCES dbo.Areas (Id)
  );

  CREATE INDEX IX_HistoricoTestes_ProjetoModuloArea ON dbo.HistoricoTestes (ProjetoId, ModuloPrincipalId, AreaId);
  CREATE INDEX IX_HistoricoTestes_TicketId ON dbo.HistoricoTestes (TicketId);
END
GO

IF OBJECT_ID('dbo.HistoricoTesteModulosImpactados', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HistoricoTesteModulosImpactados (
    HistoricoId NVARCHAR(120) NOT NULL,
    ModuloId INT NOT NULL,
    CONSTRAINT PK_HistoricoTesteModulosImpactados PRIMARY KEY (HistoricoId, ModuloId),
    CONSTRAINT FK_HistoricoTesteModulosImpactados_Historico FOREIGN KEY (HistoricoId) REFERENCES dbo.HistoricoTestes (HistoricoId) ON DELETE CASCADE,
    CONSTRAINT FK_HistoricoTesteModulosImpactados_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id)
  );
END
GO

IF OBJECT_ID('dbo.HistoricoTesteTags', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HistoricoTesteTags (
    HistoricoId NVARCHAR(120) NOT NULL,
    Tag NVARCHAR(120) NOT NULL,
    CONSTRAINT PK_HistoricoTesteTags PRIMARY KEY (HistoricoId, Tag),
    CONSTRAINT FK_HistoricoTesteTags_Historico FOREIGN KEY (HistoricoId) REFERENCES dbo.HistoricoTestes (HistoricoId) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.HistoricoTesteQuadros', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HistoricoTesteQuadros (
    HistoricoId NVARCHAR(120) NOT NULL,
    QuadroId NVARCHAR(120) NOT NULL,
    OrigemQuadro NVARCHAR(20) NOT NULL,
    FileName NVARCHAR(255) NULL,
    DownloadUrl NVARCHAR(500) NULL,
    CaminhoStorage NVARCHAR(500) NULL,
    Descricao NVARCHAR(MAX) NULL,
    CONSTRAINT PK_HistoricoTesteQuadros PRIMARY KEY (HistoricoId, QuadroId),
    CONSTRAINT FK_HistoricoTesteQuadros_Historico FOREIGN KEY (HistoricoId) REFERENCES dbo.HistoricoTestes (HistoricoId) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.ChamadoPromptsIA', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChamadoPromptsIA (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TicketId NVARCHAR(120) NOT NULL,
    ModoPrompt NVARCHAR(80) NOT NULL,
    PromptGerado NVARCHAR(MAX) NOT NULL,
    RespostaColada NVARCHAR(MAX) NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoPromptsIA_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_ChamadoPromptsIA_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_ChamadoPromptsIA_Chamados FOREIGN KEY (TicketId) REFERENCES dbo.Chamados (TicketId) ON DELETE CASCADE
  );

  CREATE INDEX IX_ChamadoPromptsIA_TicketId ON dbo.ChamadoPromptsIA (TicketId, DataCriacao DESC);
END
GO

IF OBJECT_ID('dbo.BugPromptsIA', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.BugPromptsIA (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BugId NVARCHAR(120) NOT NULL,
    ModoPrompt NVARCHAR(80) NOT NULL,
    PromptGerado NVARCHAR(MAX) NOT NULL,
    RespostaColada NVARCHAR(MAX) NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_BugPromptsIA_DataCriacao DEFAULT (SYSDATETIME()),
    DataAtualizacao DATETIME2(0) NOT NULL CONSTRAINT DF_BugPromptsIA_DataAtualizacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_BugPromptsIA_Bugs FOREIGN KEY (BugId) REFERENCES dbo.Bugs (BugId) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID('dbo.HistoricoRelacionamentos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.HistoricoRelacionamentos (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    HistoricoOrigemId NVARCHAR(120) NOT NULL,
    HistoricoRelacionadoId NVARCHAR(120) NOT NULL,
    TipoRelacionamento NVARCHAR(60) NOT NULL,
    DataCriacao DATETIME2(0) NOT NULL CONSTRAINT DF_HistoricoRelacionamentos_DataCriacao DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_HistoricoRelacionamentos_Origem FOREIGN KEY (HistoricoOrigemId) REFERENCES dbo.HistoricoTestes (HistoricoId) ON DELETE CASCADE,
    CONSTRAINT FK_HistoricoRelacionamentos_Relacionado FOREIGN KEY (HistoricoRelacionadoId) REFERENCES dbo.HistoricoTestes (HistoricoId),
    CONSTRAINT CK_HistoricoRelacionamentos_Diferentes CHECK (HistoricoOrigemId <> HistoricoRelacionadoId)
  );

  CREATE INDEX IX_HistoricoRelacionamentos_Origem ON dbo.HistoricoRelacionamentos (HistoricoOrigemId);
END
GO

IF OBJECT_ID('dbo.TestPlans', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TestPlans (
    Id NVARCHAR(120) NOT NULL PRIMARY KEY,
    Titulo NVARCHAR(250) NOT NULL,
    Objetivo NVARCHAR(MAX) NULL,
    ProjetoId INT NOT NULL,
    ModuloId INT NOT NULL,
    AreaId INT NULL,
    ChamadoIdOrigem NVARCHAR(120) NULL,
    BugIdOrigem NVARCHAR(120) NULL,
    Tipo NVARCHAR(80) NULL,
    Criticidade NVARCHAR(30) NULL,
    IncluirEmRegressao BIT NOT NULL CONSTRAINT DF_TestPlans_IncluirEmRegressao DEFAULT (0),
    Status NVARCHAR(30) NOT NULL CONSTRAINT DF_TestPlans_Status DEFAULT ('rascunho'),
    CriadoPorUsuarioId NVARCHAR(120) NULL,
    CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlans_CriadoEm DEFAULT (SYSDATETIME()),
    AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlans_AtualizadoEm DEFAULT (SYSDATETIME()),
    FinalizadoEm DATETIME2(0) NULL,
    CONSTRAINT FK_TestPlans_Projetos FOREIGN KEY (ProjetoId) REFERENCES dbo.Projetos (Id),
    CONSTRAINT FK_TestPlans_Modulos FOREIGN KEY (ModuloId) REFERENCES dbo.Modulos (Id),
    CONSTRAINT FK_TestPlans_Areas FOREIGN KEY (AreaId) REFERENCES dbo.Areas (Id),
    CONSTRAINT FK_TestPlans_Chamados FOREIGN KEY (ChamadoIdOrigem) REFERENCES dbo.Chamados (TicketId)
  );

  CREATE INDEX IX_TestPlans_ProjetoModulo ON dbo.TestPlans (ProjetoId, ModuloId);
  CREATE INDEX IX_TestPlans_Status ON dbo.TestPlans (Status);
  CREATE INDEX IX_TestPlans_CriadoPorUsuarioId ON dbo.TestPlans (CriadoPorUsuarioId);
END
GO

IF OBJECT_ID('dbo.TestPlanSteps', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TestPlanSteps (
    Id NVARCHAR(120) NOT NULL PRIMARY KEY,
    TestPlanId NVARCHAR(120) NOT NULL,
    Ordem INT NOT NULL,
    Acao NVARCHAR(MAX) NOT NULL,
    ResultadoEsperado NVARCHAR(MAX) NOT NULL,
    CriadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlanSteps_CriadoEm DEFAULT (SYSDATETIME()),
    AtualizadoEm DATETIME2(0) NOT NULL CONSTRAINT DF_TestPlanSteps_AtualizadoEm DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_TestPlanSteps_TestPlans FOREIGN KEY (TestPlanId) REFERENCES dbo.TestPlans (Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_TestPlanSteps_TestPlanId ON dbo.TestPlanSteps (TestPlanId, Ordem);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE Nome = 'Aluno')
  INSERT INTO dbo.Areas (Nome) VALUES ('Aluno');
IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE Nome = 'Professor')
  INSERT INTO dbo.Areas (Nome) VALUES ('Professor');
IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE Nome = 'Secretaria')
  INSERT INTO dbo.Areas (Nome) VALUES ('Secretaria');
IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE Nome = 'Admin')
  INSERT INTO dbo.Areas (Nome) VALUES ('Admin');
GO
