import StatusBadge from "../UI/StatusBadge.jsx";
import ToggleSwitch from "../UI/ToggleSwitch.jsx";
import ActionButtons from "../UI/ActionButtons.jsx";
import { formatCurrency } from "../../utils/format.js";
import "./ProductRow.css";

export default function ProductRow({ product, onDelete, onEdit }) {
  return (
    <tr className="product-row">
      <td className="product-row__check">
        <input type="checkbox" />
      </td>
      <td className="product-row__product">
        <img
          className="product-row__image"
          src={product.image}
          alt={product.name}
        />
        <div>
          <div className="product-row__name">{product.name}</div>
          <div className="product-row__id">{product.id}</div>
        </div>
      </td>
      <td>{product.category}</td>
      <td>{formatCurrency(product.price)}</td>
      <td>{formatCurrency(product.salePrice)}</td>
      <td>{product.stock}</td>
      <td>
        <StatusBadge status={product.status} />
      </td>
      <td>
        <button className="product-row__view">👁</button>
      </td>
      <td>
        <ToggleSwitch checked={product.published} />
      </td>
      <td>
        <ActionButtons onDelete={onDelete} onEdit={onEdit} />
      </td>
    </tr>
  );
}
