// Material UI Grid Utils for v7
import { forwardRef } from "react";
import { Grid, GridProps } from "@mui/material";

// Create a properly configured Grid component that accepts the 'item' prop
export const GridItem = forwardRef<
  HTMLDivElement,
  GridProps & { item?: boolean }
>(({ children, ...props }, ref) => {
  return (
    <Grid {...props} ref={ref}>
      {children}
    </Grid>
  );
});

GridItem.displayName = "GridItem";

// Create a properly configured Grid component that accepts the 'container' prop
export const GridContainer = forwardRef<
  HTMLDivElement,
  GridProps & { container?: boolean }
>(({ children, ...props }, ref) => {
  return (
    <Grid {...props} ref={ref}>
      {children}
    </Grid>
  );
});

GridContainer.displayName = "GridContainer";
