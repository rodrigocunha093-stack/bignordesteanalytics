-- BIGNORDESTE ANALYTICS
-- Arquivo esperado: departamentos_campanha.txt
-- Objetivo: entender quais departamentos sustentam venda, lucro e margem da campanha.
-- Troque :id_loja, :mes, :data_inicio e :data_fim antes de executar.

SELECT
    v.id_loja AS loja,
    ':mes' AS mes,
    i.id_tipooferta,
    t.descricao AS campanha,
    p.mercadologico1,
    m.descricao AS descricao_departamento,
    COUNT(DISTINCT i.id_produto) AS produtos,
    SUM(i.quantidade) AS quantidade,
    SUM(i.valortotal) AS venda,
    SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade) AS lucro,
    ROUND(
        (SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade))
        / NULLIF(SUM(i.valortotal),0) * 100
    ,2) AS margem
FROM pdv.venda v
INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id
INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta
INNER JOIN public.produto p
    ON p.id = i.id_produto
INNER JOIN public.mercadologico m
    ON m.mercadologico1 = p.mercadologico1
   AND m.nivel = 1
WHERE v.id_loja = :id_loja
  AND v.data >= ':data_inicio'
  AND v.data < ':data_fim'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE
GROUP BY
    v.id_loja,
    i.id_tipooferta,
    t.descricao,
    p.mercadologico1,
    m.descricao
ORDER BY
    campanha,
    venda DESC;
