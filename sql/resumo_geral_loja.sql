-- BIGNORDESTE ANALYTICS
-- Arquivo esperado: resumo_geral_loja.txt
-- Objetivo: gerar a base mensal total da loja para calcular participacao das ofertas.
-- Troque :id_loja, :mes, :data_inicio e :data_fim antes de executar.

SELECT
    v.id_loja AS loja,
    ':mes' AS mes,
    SUM(i.valortotal) AS venda_total,
    SUM(i.customediocomimposto * i.quantidade) AS custo_total,
    SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade) AS lucro_total,
    ROUND(
        (SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade))
        / NULLIF(SUM(i.valortotal),0) * 100
    ,2) AS margem_total,
    COUNT(DISTINCT v.id) AS cupons_totais,
    SUM(i.quantidade) AS unidades_totais
FROM pdv.venda v
INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id
WHERE v.id_loja = :id_loja
  AND v.data >= ':data_inicio'
  AND v.data < ':data_fim'
  AND v.cancelado = FALSE;
