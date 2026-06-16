-- BIGNORDESTE ANALYTICS
-- Arquivo esperado: campanhas_ofertas.txt
-- Objetivo: comparar venda, lucro, margem, cupons e variedade por campanha/oferta.
-- Troque :id_loja, :mes, :data_inicio e :data_fim antes de executar.

SELECT
    v.id_loja AS loja,
    ':mes' AS mes,
    i.id_tipooferta,
    t.descricao,
    SUM(i.valortotal) AS venda,
    SUM(i.customediocomimposto * i.quantidade) AS custo,
    SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade) AS lucro,
    ROUND(
        (SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade))
        / NULLIF(SUM(i.valortotal),0) * 100
    ,2) AS margem,
    SUM(i.quantidade) AS quantidade,
    COUNT(*) AS itens,
    COUNT(DISTINCT i.id_produto) AS produtos_distintos,
    COUNT(DISTINCT v.id) AS cupons,
    ROUND(SUM(i.valortotal) / NULLIF(COUNT(DISTINCT v.id),0),2) AS ticket_medio,
    ROUND(SUM(i.valortotal) / NULLIF(SUM(i.quantidade),0),2) AS preco_medio
FROM pdv.venda v
INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id
INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta
WHERE v.id_loja = :id_loja
  AND v.data >= ':data_inicio'
  AND v.data < ':data_fim'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE
GROUP BY
    v.id_loja,
    i.id_tipooferta,
    t.descricao
ORDER BY
    venda DESC;
