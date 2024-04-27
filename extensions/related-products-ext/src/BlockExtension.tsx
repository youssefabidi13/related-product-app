import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  ChoiceList,
  ProgressIndicator,
  InlineStack,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useMemo, useState } from "react";
import { AdminApi, Product } from "./AdminAPI";

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = "admin.product-details.block.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  // The useApi hook provides access to several useful APIs like i18n and data.
  const { data, query } = useApi(TARGET);
  const adminApi = useMemo(() => new AdminApi(query), []);
  const [selectedChoice, setSelectedChoice] = useState<string[]>([]); // Track user selection as array of strings
  const [metafieldId, setMetafieldId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<Product>(null);
  const [relatedProductBasedOnTags, setRelatedProductBasedOnTags] = useState<
    Product[]
  >([]);
  const [currentProductTags, setCurrentProductTags] = useState<string[]>([]);
  const [checker, setChecker] = useState(false);
  const [checkerMetafieldId, setCheckerMetafieldId] = useState(false);

  const handleChoiceChange = (selectedOptions) => {
    // Update the selectedChoice state with the new selection
    setSelectedChoice(selectedOptions);
  };
  const fetchCurrentProduct = async () => {
    const productId = data.selected[0].id;
    const product = await adminApi.getCurrentProductWithTags(productId);
    setProduct(product);
    const tags = product?.tags || [];

    setCurrentProductTags(tags);
  };
  async function checkIfMetafieldExist() {
    try {
      const result = await adminApi.checkIfMetafieldExist();
      const exists = result.data.metafieldDefinitions.edges.length > 0;
      if (exists) {
        const metafieldId =
          (await adminApi.getCurrentProduct(data.selected[0].id)) || null;
        const metafieldExists = metafieldId !== null;
        setCheckerMetafieldId(metafieldExists);
        if (metafieldExists) {
          setMetafieldId(metafieldId.id);
        }
      }
      setChecker(exists);
    } catch (error) {
      console.error("Error checking if metafield exist:", error);
    }
  }
  useEffect(() => {
    checkIfMetafieldExist();
  }, []);
  useEffect(() => {
    fetchCurrentProduct();
  }, [data.selected]);
  const fetchRelatedProductBasedOnTags = async () => {
    if (product) {
      const relatedProducts: Product[] = [];
      const productCounts = {};
      for (const tag of product.tags) {
        try {
          const productsWithTag = await adminApi.getAllProducts(tag);

          if (productsWithTag) {
            productsWithTag.map((p) => {
              if (p.id !== product.id) {
                relatedProducts.push(p);
                productCounts[p.id] = productCounts[p.id]
                  ? productCounts[p.id] + 1
                  : 1;
              }
            });
          }
        } catch (error) {
          console.error("Error fetching related products:", error);
        }
      }
      console.log("table : " + JSON.stringify(productCounts));
      const uniqueCounts = Array.from(new Set(Object.values(productCounts)));
      console.log("Unique counts:", uniqueCounts);
      // Calculate the sum of unique counts
      const sum = uniqueCounts.reduce(
        (acc: number, count: number) => acc + count,
        0
      ) as number;

      // Calculate the average
      const avg = sum / uniqueCounts.length;

      console.log("Average:", avg);
      // Deduplicate products by their id
      // const uniqueRelatedProducts = relatedProducts.filter(
      //   (product, index, self) =>
      //     self.findIndex((p) => p.id === product.id) === index
      // );

      const uniqueRelatedProducts = relatedProducts
        .filter((product) => productCounts[product.id] > avg)
        .filter(
          (product, index, self) =>
            self.findIndex((p) => p.id === product.id) === index
        );

      // Set the state variable relatedProductBasedOnTags
      setRelatedProductBasedOnTags(uniqueRelatedProducts);
    }
  };

  useEffect(() => {
    if (product) {
      fetchRelatedProductBasedOnTags();
    }
  }, [product]);

  async function generateRelatedProduct() {
    setIsLoading(true);
    try {
      if (!checker) {
        const response =
          await adminApi.createMetafieldRelatedProductDefinition();
        const id = response.data.metafieldDefinitionCreate.createdDefinition.id;
        setMetafieldId(id);

        await adminApi.pinMetafield(id);
      }
      if (product) {
        const relatedProductIds = relatedProductBasedOnTags.map((p) => p.id);

        switch (selectedChoice.join(",")) {
          case "1":
            if (checkerMetafieldId) {
              await adminApi.createRelatedProductIfMetafieldExist(
                relatedProductIds,
                data.selected[0].id,
                metafieldId
              );
            } else {
              await adminApi.createRelatedProduct(
                relatedProductIds,
                data.selected[0].id
              );
            }
            break;
          case "2":
            console.log("choix 2");
            break;
          case "3":
            console.log("choix 3");
            break;
          case "1,2":
            console.log("choix 1 et 2");
            break;
          case "1,3":
            console.log("choix 1 et 3");
            break;
          case "2,3":
            console.log("choix 2 et 3");
            break;
          case "1,2,3":
            console.log("choix 1 et 2 et 3");
            break;
          default:
            console.log("choix default");
            break;
        }
      }
    } catch (e) {
      console.error("Error generating related products:", e);
    } finally {
      setIsLoading(false); // Set loading to false when done generating related products
    }
  }
  return (
    <AdminBlock title="Related products extension">
      {isLoading ? ( // Render spinner if loading is true
        <InlineStack gap inlineAlignment="center">
          <ProgressIndicator size="small-200" />
        </InlineStack>
      ) : (
        <BlockStack gap="base">
          {/* Your main content */}
          <Text>
            Select based on what you want to create a related product for the
            actual product
          </Text>
          <BlockStack gap="large">
            <ChoiceList
              multiple={true}
              name="based on what"
              choices={[
                { label: "tags", id: "1" },
                { label: "collections", id: "2" },
                { label: "customer experience", id: "3" },
              ]}
              onChange={handleChoiceChange}
            />
            <Button
              disabled={selectedChoice.length === 0}
              onClick={generateRelatedProduct}
              variant="primary"
            >
              Submit
            </Button>
          </BlockStack>
        </BlockStack>
      )}
    </AdminBlock>
  );
}
