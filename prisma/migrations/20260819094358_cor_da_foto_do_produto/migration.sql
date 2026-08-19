-- ============================================================================
-- A COR DA FOTO DO PRODUTO
-- ============================================================================
-- Pedido do cliente em 18/08/2026: numa baby look com três cores, escolher a
-- cor na loja precisa trocar a FOTO junto com o preço. Até aqui a variante
-- sabia a cor e a imagem sabia o produto, e nada ligava as duas.
--
-- Nulo é o padrão e significa "serve para qualquer cor". Por isso esta
-- migração não quebra nada: toda foto existente continua aparecendo para toda
-- cor, exatamente como antes, e a associação só passa a existir onde alguém a
-- declarar.
--
-- Sem índice de propósito: o filtro acontece sobre as fotos de UM produto, que
-- são no máximo algumas dezenas e já vêm carregadas na mesma consulta. Um
-- índice aqui custaria escrita em todo upload para uma leitura que nunca vai
-- ao banco por ele.
-- ============================================================================

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "colorName" VARCHAR(60);
