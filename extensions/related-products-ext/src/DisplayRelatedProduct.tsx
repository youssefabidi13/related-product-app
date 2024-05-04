import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Image,
  Box,
  Icon,
  ProgressIndicator,
  Divider,
  Heading,
  InlineStack,
  Link,
  Button,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useMemo, useState } from "react";
import { AdminApi } from "./AdminAPI";

const TARGET = "admin.product-details.block.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data, query } = useApi(TARGET);
  const adminApi = useMemo(() => new AdminApi(query), []);
  const [metafieldId, setMetafieldId] = useState("");
  const [productsIds, setProductIds] = useState<any>();
  const [products, setProducts] = useState<
    | {
        id: string;
        title: string;
        featuredImage?: {
          url: string;
          altText: string | null;
        };
      }[]
    | null
  >(null);
  async function getMetafieldId() {
    try {
      const metafieldId =
        (await adminApi.getCurrentProduct(data.selected[0].id)) || null;

      setMetafieldId(metafieldId.id);
    } catch (error) {
      console.error("Error checking if metafield exist:", error);
    }
  }
  useEffect(() => {
    getMetafieldId();
  }, []);
  async function fetchRelatedProductIds() {
    const result = await query<{
      product: {
        title: string;
        metafield: {
          value: string;
        } | null;
      };
    }>(`query {
          product(id: "${data.selected[0].id}") {
            title
            metafield(key :"related_products_",namespace:"custom"){
              value
            }
          }
        }`);
    if (!result.errors && result.data) {
      const relatedProductIds = result.data.product.metafield.value;
      const parsedArray = JSON.parse(relatedProductIds);
      return parsedArray; // Return the array of related product IDs
    } else {
      console.error(result);
      return []; // Return an empty array if there's an error
    }
  }
  useEffect(() => {
    fetchRelatedProductIds();
    async function fetchRelatedProducts(productIds: string[]) {
      const updatedProducts: typeof products = [];
      for (const id of productIds) {
        const result = await query<{
          product: {
            id: string;
            title: string;
            featuredImage?: {
              altText: string | null;
              url: string;
            };
          };
        }>(`query {
            product(id: "${id}") {
                id
                title
                featuredImage {
                    altText
                    url
                }
            }
        }`);
        if (!result.errors && result.data) {
          updatedProducts.push(result.data.product); // Push the fetched product into the updated array
        } else {
          console.error(result);
        }
      }
      setProducts(updatedProducts);
    }

    async function fetchRelatedProductsAndUpdate() {
      try {
        const productIds = await fetchRelatedProductIds();
        setProductIds(productIds);
        await fetchRelatedProducts(productIds);
      } catch (error) {
        console.error(error);
      }
    }

    fetchRelatedProductsAndUpdate();
  }, [data.selected,productsIds]);
  useEffect(() => {
    fetchRelatedProductIds();
  }, []);
  const deleteProductFromRelatedProduct = async (productIdTodelete: string) => {
    const productId = data.selected[0].id;
    const newProductIds = productsIds.filter((id) => id !== productIdTodelete);
    try {
      await adminApi.deleteProductformMetafieldRelatedProduct(
        newProductIds,
        data.selected[0].id,
        metafieldId
      );
      // console.log(`Product with ID ${productId} deleted from related products`);
    } catch (error) {
      console.error("Failed to delete product from related products", error);
    }
  };
  if (products === null) {
    return (
      <InlineStack inlineAlignment="center">
        <ProgressIndicator size="base" />;
      </InlineStack>
    );
  }
  if (products.length === 0) {
    return (
      <InlineStack inlineAlignment="center">
        <Heading>This product doesn't have any related products.</Heading>
      </InlineStack>
    );
  }
  const IMAGE_SIZE = 80;
  return (
    // The AdminBlock component provides an API for setting the title of the Block extension wrapper.
    <AdminBlock title="My Block Extension">
      <BlockStack gap="base">
        <Heading size={2}>Related products</Heading>
        <BlockStack gap="large">
          {products?.map((product, i) => {
            return (
              <>
                {console.log("", JSON.stringify(product))}
                {/* console log id and please i dont want to return undefined */}

                {console.log("id :" + product.id)}
                {console.log("title :", product.title)}
                <Divider />

                <InlineStack inlineAlignment="space-between" blockAlignment="center">
                  <InlineStack key={i} gap="base" blockAlignment="center">
                    {product.featuredImage?.url ? (
                      <Box inlineSize={IMAGE_SIZE} blockSize={IMAGE_SIZE}>
                        <Image
                          source={product.featuredImage.url}
                          alt={
                            product.featuredImage.altText
                              ? product.featuredImage.altText
                              : "blanc"
                          }
                        />
                      </Box>
                    ) : (
                      <Box inlineSize={IMAGE_SIZE} blockSize={IMAGE_SIZE}>
                        <Icon name="ImageMajor" />
                      </Box>
                    )}

                    <Link
                      to={`shopify:admin/products/${product.id
                        .split("/")
                        .at(-1)}`}
                    >
                      {product.title}
                    </Link>
                    
                  </InlineStack>
                  <Button to={`shopify:admin/products/${data.selected[0].id
                        .split("/")
                        .at(-1)}`}
                    // disabled={selectedChoice.length === 0}
                    onClick={() => deleteProductFromRelatedProduct(product.id)}
                    variant="primary"
                    >
                      Delete this product from the list
                    </Button>
                  {/* <InlineStack inlineAlignment="end">
                    <Link
                      to={`shopify:admin/products/${product.id
                        .split("/")
                        .at(-1)}`}
                    >
                      view product
                    </Link>
                  </InlineStack> */}
                </InlineStack>
              </>
            );
          })}
        </BlockStack>
      </BlockStack>
    </AdminBlock>
  );
}
